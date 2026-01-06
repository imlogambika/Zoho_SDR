const catalyst = require('zcatalyst-sdk-node');

module.exports = async (req, res) => {
    const app = catalyst.initialize(req);
    const { action, data } = req.body;
    
    const zia = app.zia();
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    try {
        switch (action) {
            case 'process_email_reply':
                return await processEmailReply(app, data, res);
            case 'analyze_lead':
                return await analyzeNewLead(app, data, res);
            case 'get_lead_insights':
                return await getLeadInsights(app, data, res);
            case 'bulk_process_leads':
                return await bulkProcessLeads(app, data, res);
            default:
                res.status(400).send({ error: 'Invalid action' });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

async function processEmailReply(app, data, res) {
    const { from_email, subject, body, lead_id } = data;
    const zia = app.zia();
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    // Zia analysis
    const sentiment = await zia.getSentimentAnalysis([body]);
    const keywords = await zia.getKeywordExtraction([body]);
    
    // Intent classification
    const intent = classifyIntent(body, sentiment[0]);
    const confidence = sentiment[0]?.confidence || 0;
    
    // Execute business rules
    const actions = await executeBusinessRules(zcql, lead_id, intent, confidence);
    
    // Log decision
    await datastore.table('ai_decisions').insertRow({
        lead_id,
        email_body: body,
        intent,
        sentiment: sentiment[0]?.sentiment,
        confidence,
        actions: actions.join(','),
        timestamp: new Date().toISOString()
    });
    
    res.status(200).send({
        success: true,
        lead_id,
        intent,
        confidence,
        actions
    });
}

async function analyzeNewLead(app, data, res) {
    const { lead_data } = data;
    const zia = app.zia();
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    // Lead scoring with Zia
    const leadText = `${lead_data.Company} ${lead_data.Industry} ${lead_data.Designation}`;
    const sentiment = await zia.getSentimentAnalysis([leadText]);
    const keywords = await zia.getKeywordExtraction([leadText]);
    
    // Calculate score
    let score = calculateLeadScore(lead_data, sentiment[0], keywords[0]);
    
    // Generate personalized messages
    const messages = generateMessages(lead_data);
    
    // Update CRM
    await zcql.executeZCQLQuery(`
        UPDATE Leads SET 
            AI_Score = ${score},
            AI_Sentiment = '${sentiment[0]?.sentiment}',
            AI_Confidence = ${sentiment[0]?.confidence || 0},
            Tamil_Message = '${messages.tamil}',
            English_Message = '${messages.english}',
            Lead_Status = '${score > 70 ? 'Hot' : score > 50 ? 'Warm' : 'Cold'}'
        WHERE ROWID = '${lead_data.lead_id}'
    `);
    
    // Store analysis
    await datastore.table('lead_scores').insertRow({
        lead_id: lead_data.lead_id,
        score,
        sentiment: sentiment[0]?.sentiment,
        keywords: keywords[0]?.keywords?.join(','),
        timestamp: new Date().toISOString()
    });
    
    res.status(200).send({
        success: true,
        lead_id: lead_data.lead_id,
        score,
        messages
    });
}

async function getLeadInsights(app, data, res) {
    const { lead_id } = data;
    const zcql = app.zcql();
    const datastore = app.datastore();
    
    // Get lead data
    const leadData = await zcql.executeZCQLQuery(`SELECT * FROM Leads WHERE ROWID = '${lead_id}'`);
    const decisions = await datastore.table('ai_decisions').getRows({
        where: `lead_id = '${lead_id}'`
    });
    const scores = await datastore.table('lead_scores').getRows({
        where: `lead_id = '${lead_id}'`
    });
    
    res.status(200).send({
        success: true,
        lead: leadData[0],
        ai_decisions: decisions,
        score_history: scores
    });
}

async function bulkProcessLeads(app, data, res) {
    const { leads } = data;
    const results = [];
    
    for (const lead of leads) {
        try {
            const result = await analyzeNewLead(app, { lead_data: lead }, { status: () => ({ send: () => {} }) });
            results.push({ lead_id: lead.lead_id, status: 'processed' });
        } catch (error) {
            results.push({ lead_id: lead.lead_id, status: 'error', error: error.message });
        }
    }
    
    res.status(200).send({
        success: true,
        processed: results.length,
        results
    });
}

function classifyIntent(body, sentiment) {
    const text = body.toLowerCase();
    
    if (text.includes('unsubscribe') || text.includes('remove me')) return 'UNSUBSCRIBE';
    if (text.includes('complaint') || text.includes('spam')) return 'COMPLAINT';
    if (text.includes('interested') || text.includes('demo') || text.includes('schedule')) return 'POSITIVE_INTEREST';
    if (text.includes('more information') || text.includes('details')) return 'NEED_MORE_INFO';
    if (text.includes('not interested') || sentiment?.sentiment === 'negative') return 'NOT_INTERESTED';
    
    return 'NEED_MORE_INFO';
}

async function executeBusinessRules(zcql, leadId, intent, confidence) {
    const actions = [];
    
    switch (intent) {
        case 'POSITIVE_INTEREST':
            await zcql.executeZCQLQuery(`UPDATE Leads SET Lead_Status = 'Qualified', AI_Intent = '${intent}' WHERE ROWID = '${leadId}'`);
            actions.push('Qualified Lead', 'Create Deal');
            break;
        case 'NEED_MORE_INFO':
            await zcql.executeZCQLQuery(`UPDATE Leads SET Lead_Status = 'Nurturing', AI_Intent = '${intent}' WHERE ROWID = '${leadId}'`);
            actions.push('Schedule Follow-up');
            break;
        case 'NOT_INTERESTED':
            await zcql.executeZCQLQuery(`UPDATE Leads SET Lead_Status = 'Disqualified', AI_Intent = '${intent}' WHERE ROWID = '${leadId}'`);
            actions.push('Stop Outreach');
            break;
        case 'COMPLAINT':
            await zcql.executeZCQLQuery(`UPDATE Leads SET Lead_Status = 'Blocked', AI_Intent = '${intent}' WHERE ROWID = '${leadId}'`);
            actions.push('Block Lead', 'Notify Admin');
            break;
        case 'UNSUBSCRIBE':
            await zcql.executeZCQLQuery(`UPDATE Leads SET Lead_Status = 'Suppressed', AI_Intent = '${intent}' WHERE ROWID = '${leadId}'`);
            actions.push('Suppress Permanently');
            break;
    }
    
    return actions;
}

function calculateLeadScore(lead, sentiment, keywords) {
    let score = 50;
    
    // Designation scoring
    if (lead.Designation?.toLowerCase().includes('ceo')) score += 30;
    else if (lead.Designation?.toLowerCase().includes('founder')) score += 25;
    else if (lead.Designation?.toLowerCase().includes('director')) score += 20;
    else if (lead.Designation?.toLowerCase().includes('manager')) score += 15;
    
    // Industry scoring (Coimbatore focus)
    const coimbatoreIndustries = ['textile', 'manufacturing', 'automotive', 'engineering', 'technology'];
    if (coimbatoreIndustries.some(ind => lead.Industry?.toLowerCase().includes(ind))) score += 20;
    
    // Sentiment scoring
    if (sentiment?.sentiment === 'positive') score += 15;
    else if (sentiment?.sentiment === 'negative') score -= 10;
    
    return Math.min(100, Math.max(0, score));
}

function generateMessages(lead) {
    const tamil = `வணக்கம் ${lead.Full_Name}! ${lead.Company} நிறுவனத்தின் ${lead.Designation} பதவியில் இருக்கும் நீங்கள் எங்கள் AI தீர்வுகளில் ஆர்வம் காட்டலாம். கோயம்புத்தூர் ${lead.Industry} துறையில் 40% வளர்ச்சி கண்டுள்ளோம்.`;
    
    const english = `Hi ${lead.Full_Name}! As ${lead.Designation} at ${lead.Company}, you might be interested in our AI solutions. We've seen 40% growth in Coimbatore's ${lead.Industry} sector.`;
    
    return { tamil, english };
}