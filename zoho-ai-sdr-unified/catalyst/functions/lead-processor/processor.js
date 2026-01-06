const catalyst = require('zcatalyst-sdk-node');

module.exports = async (req, res) => {
    const app = catalyst.initialize(req);
    const { action, data } = req.body;
    
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    try {
        switch (action) {
            case 'import_leads':
                return await importLeads(app, data, res);
            case 'update_lead_status':
                return await updateLeadStatus(app, data, res);
            case 'create_tasks':
                return await createTasks(app, data, res);
            case 'generate_reports':
                return await generateReports(app, data, res);
            case 'manage_suppression':
                return await manageSuppressionList(app, data, res);
            default:
                res.status(400).send({ error: 'Invalid action' });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

async function importLeads(app, data, res) {
    const { leads } = data;
    const zcql = app.zcql();
    const results = [];
    
    for (const lead of leads) {
        try {
            // Insert lead into CRM
            const insertQuery = `
                INSERT INTO Leads (
                    Company, Full_Name, Email, Phone, Designation, 
                    Industry, Lead_Source, City, State, Country,
                    AI_Score, Lead_Status, Created_Time
                ) VALUES (
                    '${lead.Company}', '${lead.Full_Name}', '${lead.Email}', 
                    '${lead.Phone}', '${lead.Designation}', '${lead.Industry}',
                    '${lead.Lead_Source}', '${lead.City}', '${lead.State}', 
                    '${lead.Country}', 0, 'New', '${new Date().toISOString()}'
                )
            `;
            
            const result = await zcql.executeZCQLQuery(insertQuery);
            
            // Trigger AI analysis for new lead
            const analysisData = {
                action: 'analyze_lead',
                data: {
                    lead_data: {
                        ...lead,
                        lead_id: result.insertId
                    }
                }
            };
            
            // Call AI-SDR core function
            await callFunction(app, 'ai-sdr-core', analysisData);
            
            results.push({
                lead_id: result.insertId,
                company: lead.Company,
                status: 'imported'
            });
            
        } catch (error) {
            results.push({
                company: lead.Company,
                status: 'error',
                error: error.message
            });
        }
    }
    
    res.status(200).send({
        success: true,
        imported: results.filter(r => r.status === 'imported').length,
        errors: results.filter(r => r.status === 'error').length,
        results
    });
}

async function updateLeadStatus(app, data, res) {
    const { lead_id, status, intent, confidence, reason } = data;
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    // Update lead in CRM
    const updateQuery = `
        UPDATE Leads SET 
            Lead_Status = '${status}',
            AI_Intent = '${intent}',
            AI_Confidence = ${confidence},
            Status_Update_Reason = '${reason}',
            Last_Modified_Time = '${new Date().toISOString()}'
        WHERE ROWID = '${lead_id}'
    `;
    
    await zcql.executeZCQLQuery(updateQuery);
    
    // Log status change
    await datastore.table('ai_decisions').insertRow({
        lead_id,
        action_type: 'STATUS_UPDATE',
        old_status: data.old_status || '',
        new_status: status,
        intent,
        confidence,
        reason,
        timestamp: new Date().toISOString()
    });
    
    // Create follow-up tasks based on status
    await createFollowUpTasks(zcql, lead_id, status, intent);
    
    res.status(200).send({
        success: true,
        lead_id,
        new_status: status,
        tasks_created: getTasksForStatus(status)
    });
}

async function createTasks(app, data, res) {
    const { tasks } = data;
    const zcql = app.zcql();
    const results = [];
    
    for (const task of tasks) {
        try {
            const insertQuery = `
                INSERT INTO Tasks (
                    Subject, Status, Priority, Due_Date, 
                    What_Id, Owner, Description, Task_Type
                ) VALUES (
                    '${task.subject}', '${task.status}', '${task.priority}',
                    '${task.due_date}', '${task.lead_id}', '${task.owner}',
                    '${task.description}', 'AI_Generated'
                )
            `;
            
            const result = await zcql.executeZCQLQuery(insertQuery);
            
            results.push({
                task_id: result.insertId,
                subject: task.subject,
                status: 'created'
            });
            
        } catch (error) {
            results.push({
                subject: task.subject,
                status: 'error',
                error: error.message
            });
        }
    }
    
    res.status(200).send({
        success: true,
        created: results.filter(r => r.status === 'created').length,
        results
    });
}

async function generateReports(app, data, res) {
    const { report_type, date_range } = data;
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    let report = {};
    
    switch (report_type) {
        case 'lead_analysis_summary':
            report = await generateLeadAnalysisSummary(zcql, datastore, date_range);
            break;
        case 'ai_performance':
            report = await generateAIPerformanceReport(datastore, date_range);
            break;
        case 'conversion_metrics':
            report = await generateConversionMetrics(zcql, date_range);
            break;
        case 'suppression_report':
            report = await generateSuppressionReport(datastore, date_range);
            break;
        default:
            return res.status(400).send({ error: 'Invalid report type' });
    }
    
    res.status(200).send({
        success: true,
        report_type,
        date_range,
        data: report
    });
}

async function manageSuppressionList(app, data, res) {
    const { action: suppressionAction, email, lead_id, reason } = data;
    const datastore = app.datastore();
    const zcql = app.zcql();
    
    switch (suppressionAction) {
        case 'add':
            await datastore.table('suppression_list').insertRow({
                lead_id,
                email,
                reason,
                suppressed_date: new Date().toISOString(),
                active: true
            });
            
            // Update lead in CRM
            await zcql.executeZCQLQuery(`
                UPDATE Leads SET 
                    Email_Opt_Out = true,
                    Suppression_Reason = '${reason}'
                WHERE ROWID = '${lead_id}'
            `);
            break;
            
        case 'remove':
            await datastore.table('suppression_list').updateRow({
                where: `email = '${email}'`,
                set: { active: false, removed_date: new Date().toISOString() }
            });
            
            await zcql.executeZCQLQuery(`
                UPDATE Leads SET Email_Opt_Out = false WHERE Email = '${email}'
            `);
            break;
            
        case 'check':
            const suppressionRecord = await datastore.table('suppression_list').getRows({
                where: `email = '${email}' AND active = true`
            });
            
            return res.status(200).send({
                success: true,
                email,
                is_suppressed: suppressionRecord.length > 0,
                reason: suppressionRecord[0]?.reason || null
            });
    }
    
    res.status(200).send({
        success: true,
        action: suppressionAction,
        email
    });
}

async function createFollowUpTasks(zcql, leadId, status, intent) {
    const taskTemplates = {
        'Qualified': {
            subject: 'Follow up with qualified lead',
            priority: 'High',
            days: 1
        },
        'Nurturing': {
            subject: 'Send nurturing content',
            priority: 'Normal',
            days: 3
        },
        'Disqualified': {
            subject: 'Review disqualified lead',
            priority: 'Low',
            days: 30
        }
    };
    
    const template = taskTemplates[status];
    if (template) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + template.days);
        
        await zcql.executeZCQLQuery(`
            INSERT INTO Tasks (
                Subject, Status, Priority, Due_Date, What_Id, Task_Type
            ) VALUES (
                '${template.subject}', 'Not Started', '${template.priority}',
                '${dueDate.toISOString()}', '${leadId}', 'AI_Generated'
            )
        `);
    }
}

async function generateLeadAnalysisSummary(zcql, datastore, dateRange) {
    const leads = await zcql.executeZCQLQuery(`
        SELECT Lead_Status, AI_Intent, AI_Score, COUNT(*) as count 
        FROM Leads 
        WHERE Created_Time >= '${dateRange.start}' 
        AND Created_Time <= '${dateRange.end}'
        GROUP BY Lead_Status, AI_Intent
    `);
    
    const decisions = await datastore.table('ai_decisions').getRows({
        where: `timestamp >= '${dateRange.start}' AND timestamp <= '${dateRange.end}'`
    });
    
    return {
        total_leads: leads.reduce((sum, l) => sum + l.count, 0),
        status_breakdown: leads,
        ai_decisions: decisions.length,
        avg_confidence: decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
    };
}

async function generateAIPerformanceReport(datastore, dateRange) {
    const decisions = await datastore.table('ai_decisions').getRows({
        where: `timestamp >= '${dateRange.start}' AND timestamp <= '${dateRange.end}'`
    });
    
    const intentCounts = {};
    let totalConfidence = 0;
    
    decisions.forEach(d => {
        intentCounts[d.intent] = (intentCounts[d.intent] || 0) + 1;
        totalConfidence += d.confidence;
    });
    
    return {
        total_decisions: decisions.length,
        intent_distribution: intentCounts,
        average_confidence: totalConfidence / decisions.length,
        high_confidence_decisions: decisions.filter(d => d.confidence > 0.8).length
    };
}

async function generateConversionMetrics(zcql, dateRange) {
    const conversions = await zcql.executeZCQLQuery(`
        SELECT 
            COUNT(*) as total_leads,
            SUM(CASE WHEN Lead_Status = 'Qualified' THEN 1 ELSE 0 END) as qualified,
            SUM(CASE WHEN Lead_Status = 'Converted' THEN 1 ELSE 0 END) as converted
        FROM Leads 
        WHERE Created_Time >= '${dateRange.start}' 
        AND Created_Time <= '${dateRange.end}'
    `);
    
    const result = conversions[0];
    return {
        total_leads: result.total_leads,
        qualified_leads: result.qualified,
        converted_leads: result.converted,
        qualification_rate: (result.qualified / result.total_leads * 100).toFixed(2),
        conversion_rate: (result.converted / result.total_leads * 100).toFixed(2)
    };
}

async function generateSuppressionReport(datastore, dateRange) {
    const suppressions = await datastore.table('suppression_list').getRows({
        where: `suppressed_date >= '${dateRange.start}' AND suppressed_date <= '${dateRange.end}'`
    });
    
    const reasonCounts = {};
    suppressions.forEach(s => {
        reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
    });
    
    return {
        total_suppressions: suppressions.length,
        reason_breakdown: reasonCounts,
        active_suppressions: suppressions.filter(s => s.active).length
    };
}

function getTasksForStatus(status) {
    const taskMap = {
        'Qualified': ['Schedule demo call', 'Send proposal'],
        'Nurturing': ['Send follow-up email', 'Add to nurture sequence'],
        'Disqualified': ['Archive lead', 'Update CRM notes']
    };
    return taskMap[status] || [];
}

async function callFunction(app, functionName, data) {
    // Helper function to call other Catalyst functions
    const functions = app.functions();
    return await functions.functionId(functionName).execute(data);
}