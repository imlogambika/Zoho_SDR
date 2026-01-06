# Zoho AI-SDR Unified System

A complete AI-powered Sales Development Representative system built entirely within the Zoho ecosystem using Catalyst, CRM, and Zia.

## 🎯 Core Features

- **Intelligent Email Processing**: Automatically analyzes email replies using Zia AI
- **Lead Scoring & Qualification**: AI-driven lead quality assessment
- **Intent Classification**: Categorizes lead responses into actionable intents
- **Automated CRM Updates**: Real-time synchronization with Zoho CRM
- **Multi-language Support**: Tamil and English message generation
- **Complete Audit Trail**: Full transparency of AI decisions

## 🏗️ Architecture

### Functions
- **ai-sdr-core** (Node.js): Main email processing and decision engine
- **zia-analyzer** (Python): Advanced AI analysis using Zia services
- **lead-processor** (Node.js): CRM operations and lead management

### Data Store Tables
- `ai_decisions`: AI decision logs with confidence scores
- `lead_scores`: Lead quality scoring history
- `email_analysis`: Detailed email analysis results
- `suppression_list`: Email suppression management

## 🚀 Quick Start

### Prerequisites
- Zoho Catalyst CLI installed
- Zoho CRM access
- Zia AI services enabled

### Installation
```bash
# Clone and setup
cd zoho-ai-sdr-unified
npm install
pip install -r requirements.txt

# Deploy to Catalyst
catalyst deploy
```

### CRM Setup
Add these custom fields to Leads module:
- AI_Score (Number)
- AI_Intent (Picklist)
- AI_Sentiment (Picklist)
- AI_Confidence (Number)
- Lead_Grade (Picklist)
- Tamil_Message (Text)
- English_Message (Text)

## 📊 API Endpoints

### AI-SDR Core
```javascript
POST /ai-sdr-core
{
  "action": "process_email_reply",
  "data": {
    "from_email": "lead@company.com",
    "subject": "Re: Your proposal",
    "body": "I'm interested in a demo",
    "lead_id": "123456"
  }
}
```

### Zia Analyzer
```python
POST /zia-analyzer
{
  "action": "advanced_sentiment_analysis",
  "data": {
    "text": "Email content here",
    "lead_id": "123456"
  }
}
```

### Lead Processor
```javascript
POST /lead-processor
{
  "action": "import_leads",
  "data": {
    "leads": [
      {
        "Company": "TechWeave Solutions",
        "Full_Name": "Rajesh Kumar",
        "Email": "rajesh@techweave.in",
        "Designation": "CEO",
        "Industry": "Technology"
      }
    ]
  }
}
```

## 🤖 AI Decision Flow

1. **Email Received** → Webhook triggers ai-sdr-core
2. **Zia Analysis** → Sentiment + keyword extraction
3. **Intent Classification** → Categorize response intent
4. **Business Rules** → Execute automated actions
5. **CRM Update** → Sync lead status and create tasks
6. **Audit Log** → Record decision with confidence score

## 📈 Intent Categories

- **POSITIVE_INTEREST**: Creates deal + assigns sales task
- **NEED_MORE_INFO**: Schedules follow-up task
- **NOT_INTERESTED**: Stops outreach campaigns
- **COMPLAINT**: Blocks lead + notifies admin
- **UNSUBSCRIBE**: Permanent suppression

## 🎯 Lead Scoring Algorithm

Base score: 50 points
- CEO/Founder: +30 points
- Director/VP: +25 points
- Manager: +15 points
- Technology/Manufacturing industry: +20 points
- Positive sentiment: +15 points
- Coimbatore location: +10 points

## 📊 Reporting Features

- Lead analysis summary
- AI performance metrics
- Conversion tracking
- Suppression reports
- Confidence score analytics

## 🔧 Configuration

### Webhook Setup
Configure Zoho Mail webhooks to trigger:
- `https://your-catalyst-domain/ai-sdr-core` on email replies

### CRM Workflows
Set up workflow rules for:
- Lead creation → Trigger lead analysis
- Status updates → Create follow-up tasks
- High-score leads → Auto-assign to sales

## 📝 Sample Data

The system includes 50 Coimbatore-based leads across:
- Textile companies
- Manufacturing firms
- Automotive suppliers
- Engineering services
- Technology startups

## 🔒 Security Features

- Email suppression management
- Complaint handling workflow
- Data privacy compliance
- Secure API endpoints
- Audit logging

## 📞 Support

Built for Zoho Developer Community Hackathon
- Uses only Zoho native services
- Leverages Zia AI capabilities
- Integrates seamlessly with CRM
- Provides measurable ROI

---

**Transform your sales process with AI-powered lead qualification in the Zoho ecosystem!**
