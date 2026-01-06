const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

// Enhanced CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());
app.use(express.static('.'));

// Mock Catalyst SDK for local testing
const mockCatalyst = {
    initialize: () => ({
        zia: () => ({
            getSentimentAnalysis: async (texts) => [{
                sentiment: 'positive',
                confidence: 0.85
            }],
            getKeywordExtraction: async (texts) => [{
                keywords: ['interested', 'demo', 'meeting']
            }]
        }),
        zcql: () => ({
            executeZCQLQuery: async (query) => {
                console.log('CRM Query:', query);
                return [{ ROWID: '123', Company: 'Test Company' }];
            }
        }),
        datastore: () => ({
            table: (name) => ({
                insertRow: async (data) => {
                    console.log(`Inserting into ${name}:`, data);
                    return { success: true };
                }
            })
        })
    })
};

// AI-SDR Core Function
async function aiSdrCore(req, res) {
    const { action, data } = req.body;
    
    try {
        const app = mockCatalyst.initialize();
        const zia = app.zia();
        const zcql = app.zcql();
        const datastore = app.datastore();
        
        switch (action) {
            case 'process_email_reply':
                const { from_email, subject, body, lead_id } = data;
                
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
                
                res.json({
                    success: true,
                    lead_id,
                    intent,
                    confidence,
                    actions,
                    sentiment: sentiment[0]?.sentiment
                });
                break;
                
            case 'analyze_lead':
                const { lead_data } = data;
                const leadText = `${lead_data.Company} ${lead_data.Industry} ${lead_data.Designation}`;
                const leadSentiment = await zia.getSentimentAnalysis([leadText]);
                const leadKeywords = await zia.getKeywordExtraction([leadText]);
                
                const score = calculateLeadScore(lead_data, leadSentiment[0], leadKeywords[0]);
                const messages = generateMessages(lead_data);
                
                await zcql.executeZCQLQuery(`UPDATE Leads SET AI_Score = ${score} WHERE ROWID = '${lead_data.lead_id}'`);
                
                res.json({
                    success: true,
                    lead_id: lead_data.lead_id,
                    score,
                    messages,
                    sentiment: leadSentiment[0]?.sentiment
                });
                break;
                
            default:
                res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
    
    if (lead.Designation?.toLowerCase().includes('ceo')) score += 30;
    else if (lead.Designation?.toLowerCase().includes('founder')) score += 25;
    else if (lead.Designation?.toLowerCase().includes('director')) score += 20;
    else if (lead.Designation?.toLowerCase().includes('manager')) score += 15;
    
    const coimbatoreIndustries = ['textile', 'manufacturing', 'automotive', 'engineering', 'technology'];
    if (coimbatoreIndustries.some(ind => lead.Industry?.toLowerCase().includes(ind))) score += 20;
    
    if (sentiment?.sentiment === 'positive') score += 15;
    else if (sentiment?.sentiment === 'negative') score -= 10;
    
    return Math.min(100, Math.max(0, score));
}

function generateMessages(lead) {
    const tamil = `வணக்கம் ${lead.Full_Name}! ${lead.Company} நிறுவனத்தின் ${lead.Designation} பதவியில் இருக்கும் நீங்கள் எங்கள் AI தீர்வுகளில் ஆர்வம் காட்டலாம். கோயம்புத்தூர் ${lead.Industry} துறையில் 40% வளர்ச்சி கண்டுள்ளோம்.`;
    
    const english = `Hi ${lead.Full_Name}! As ${lead.Designation} at ${lead.Company}, you might be interested in our AI solutions. We've seen 40% growth in Coimbatore's ${lead.Industry} sector.`;
    
    return { tamil, english };
}

// Serve static files
app.use(express.static('.'));

// Serve the main interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/index.html', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Routes
app.post('/ai-sdr-core', aiSdrCore);

app.get('/health', (req, res) => {
    res.json({ 
        status: 'running',
        service: 'Zoho AI-SDR Unified System',
        timestamp: new Date().toISOString()
    });
});

app.get('/demo', (req, res) => {
    res.json({
        message: 'Zoho AI-SDR Demo Endpoints',
        endpoints: {
            'POST /ai-sdr-core': 'Main AI processing endpoint',
            'GET /health': 'Health check',
            'GET /demo': 'This demo info'
        },
        sample_requests: {
            email_processing: {
                action: 'process_email_reply',
                data: {
                    from_email: 'rajesh@techweave.in',
                    subject: 'Re: AI Solutions',
                    body: 'I am interested in scheduling a demo',
                    lead_id: '123456'
                }
            },
            lead_analysis: {
                action: 'analyze_lead',
                data: {
                    lead_data: {
                        lead_id: '123456',
                        Company: 'TechWeave Solutions',
                        Full_Name: 'Rajesh Kumar',
                        Designation: 'CEO',
                        Industry: 'Technology'
                    }
                }
            }
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 Zoho AI-SDR Unified System running on http://localhost:${port}`);
    console.log(`📊 Demo endpoint: http://localhost:${port}/demo`);
    console.log(`❤️  Health check: http://localhost:${port}/health`);
    console.log(`🤖 AI-SDR Core: POST http://localhost:${port}/ai-sdr-core`);
});

module.exports = app;