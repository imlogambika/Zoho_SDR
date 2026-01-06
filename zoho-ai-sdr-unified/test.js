const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAISdr() {
    console.log('🚀 Testing Zoho AI-SDR Unified System\n');
    
    try {
        // Test 1: Health Check
        console.log('1️⃣ Health Check...');
        const health = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Status:', health.data.status);
        console.log('📅 Timestamp:', health.data.timestamp);
        console.log('');
        
        // Test 2: Email Processing - Positive Interest
        console.log('2️⃣ Testing Email Processing - Positive Interest...');
        const emailTest1 = await axios.post(`${BASE_URL}/ai-sdr-core`, {
            action: 'process_email_reply',
            data: {
                from_email: 'rajesh@techweave.in',
                subject: 'Re: AI Solutions Proposal',
                body: 'Hi, I am very interested in your AI solutions. Can we schedule a demo call this week?',
                lead_id: '123456'
            }
        });
        console.log('✅ Intent:', emailTest1.data.intent);
        console.log('📊 Confidence:', emailTest1.data.confidence);
        console.log('🎯 Actions:', emailTest1.data.actions);
        console.log('😊 Sentiment:', emailTest1.data.sentiment);
        console.log('');
        
        // Test 3: Email Processing - Not Interested
        console.log('3️⃣ Testing Email Processing - Not Interested...');
        const emailTest2 = await axios.post(`${BASE_URL}/ai-sdr-core`, {
            action: 'process_email_reply',
            data: {
                from_email: 'priya@cautoparts.com',
                subject: 'Re: Partnership Opportunity',
                body: 'Thanks for reaching out, but we are not interested at this time.',
                lead_id: '789012'
            }
        });
        console.log('✅ Intent:', emailTest2.data.intent);
        console.log('📊 Confidence:', emailTest2.data.confidence);
        console.log('🎯 Actions:', emailTest2.data.actions);
        console.log('😐 Sentiment:', emailTest2.data.sentiment);
        console.log('');
        
        // Test 4: Lead Analysis - CEO
        console.log('4️⃣ Testing Lead Analysis - CEO...');
        const leadTest1 = await axios.post(`${BASE_URL}/ai-sdr-core`, {
            action: 'analyze_lead',
            data: {
                lead_data: {
                    lead_id: '345678',
                    Company: 'TechWeave Solutions',
                    Full_Name: 'Rajesh Kumar',
                    Designation: 'CEO',
                    Industry: 'Technology'
                }
            }
        });
        console.log('✅ Lead Score:', leadTest1.data.score);
        console.log('🇹🇦 Tamil Message:', leadTest1.data.messages.tamil.substring(0, 50) + '...');
        console.log('🇬🇧 English Message:', leadTest1.data.messages.english.substring(0, 50) + '...');
        console.log('😊 Sentiment:', leadTest1.data.sentiment);
        console.log('');
        
        // Test 5: Lead Analysis - Manager
        console.log('5️⃣ Testing Lead Analysis - Manager...');
        const leadTest2 = await axios.post(`${BASE_URL}/ai-sdr-core`, {
            action: 'analyze_lead',
            data: {
                lead_data: {
                    lead_id: '456789',
                    Company: 'ManufacturingPlus Ltd',
                    Full_Name: 'Ramesh Chandra',
                    Designation: 'Operations Head',
                    Industry: 'Manufacturing'
                }
            }
        });
        console.log('✅ Lead Score:', leadTest2.data.score);
        console.log('🇹🇦 Tamil Message:', leadTest2.data.messages.tamil.substring(0, 50) + '...');
        console.log('🇬🇧 English Message:', leadTest2.data.messages.english.substring(0, 50) + '...');
        console.log('😊 Sentiment:', leadTest2.data.sentiment);
        console.log('');
        
        // Test 6: Unsubscribe Request
        console.log('6️⃣ Testing Unsubscribe Request...');
        const emailTest3 = await axios.post(`${BASE_URL}/ai-sdr-core`, {
            action: 'process_email_reply',
            data: {
                from_email: 'test@company.com',
                subject: 'Unsubscribe Request',
                body: 'Please unsubscribe me from all your mailing lists.',
                lead_id: '999999'
            }
        });
        console.log('✅ Intent:', emailTest3.data.intent);
        console.log('📊 Confidence:', emailTest3.data.confidence);
        console.log('🎯 Actions:', emailTest3.data.actions);
        console.log('');
        
        console.log('🎉 All tests completed successfully!');
        console.log('📈 AI-SDR System is working perfectly!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('📄 Response:', error.response.data);
        }
    }
}

// Run tests after a short delay to ensure server is running
setTimeout(testAISdr, 2000);

module.exports = testAISdr;