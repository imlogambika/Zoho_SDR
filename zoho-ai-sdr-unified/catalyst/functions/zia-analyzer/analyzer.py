from zcatalyst import catalyst
import json
import re

def handler(request):
    app = catalyst.initialize(request)
    body = json.loads(request.body) if isinstance(request.body, str) else request.body
    action = body.get('action')
    data = body.get('data', {})
    
    zia = app.zia()
    zcql = app.zcql()
    datastore = app.datastore()
    
    try:
        if action == 'advanced_sentiment_analysis':
            return advanced_sentiment_analysis(zia, datastore, data)
        elif action == 'lead_quality_prediction':
            return lead_quality_prediction(zia, zcql, data)
        elif action == 'email_intent_classification':
            return email_intent_classification(zia, datastore, data)
        elif action == 'bulk_lead_analysis':
            return bulk_lead_analysis(zia, zcql, datastore, data)
        else:
            return {'statusCode': 400, 'body': {'error': 'Invalid action'}}
    except Exception as e:
        return {'statusCode': 500, 'body': {'error': str(e)}}

def advanced_sentiment_analysis(zia, datastore, data):
    text = data.get('text', '')
    lead_id = data.get('lead_id', '')
    
    # Zia sentiment analysis
    sentiment_result = zia.get_sentiment_analysis([text])
    keyword_result = zia.get_keyword_extraction([text])
    
    # Advanced analysis
    sentiment_data = sentiment_result[0] if sentiment_result else {}
    keywords = keyword_result[0].get('keywords', []) if keyword_result else []
    
    # Calculate advanced metrics
    urgency_score = calculate_urgency(text, keywords)
    buying_intent = calculate_buying_intent(text, keywords)
    
    # Store analysis
    analysis_record = {
        'lead_id': lead_id,
        'text': text,
        'sentiment': sentiment_data.get('sentiment', 'neutral'),
        'confidence': sentiment_data.get('confidence', 0),
        'keywords': ','.join(keywords),
        'urgency_score': urgency_score,
        'buying_intent': buying_intent,
        'timestamp': catalyst.get_current_time()
    }
    
    datastore.table('email_analysis').insert_row(analysis_record)
    
    return {
        'statusCode': 200,
        'body': {
            'success': True,
            'sentiment': sentiment_data.get('sentiment'),
            'confidence': sentiment_data.get('confidence'),
            'urgency_score': urgency_score,
            'buying_intent': buying_intent,
            'keywords': keywords
        }
    }

def lead_quality_prediction(zia, zcql, data):
    lead_data = data.get('lead_data', {})
    
    # Prepare text for analysis
    company_text = f"{lead_data.get('Company', '')} {lead_data.get('Industry', '')}"
    designation_text = lead_data.get('Designation', '')
    
    # Zia analysis
    company_sentiment = zia.get_sentiment_analysis([company_text])
    designation_keywords = zia.get_keyword_extraction([designation_text])
    
    # Quality prediction algorithm
    quality_score = predict_lead_quality(lead_data, company_sentiment, designation_keywords)
    
    # Update CRM
    lead_id = lead_data.get('lead_id')
    if lead_id:
        update_query = f"""
            UPDATE Leads SET 
                AI_Quality_Score = {quality_score},
                AI_Prediction_Date = '{catalyst.get_current_time()}',
                Lead_Grade = '{get_lead_grade(quality_score)}'
            WHERE ROWID = '{lead_id}'
        """
        zcql.execute_query(update_query)
    
    return {
        'statusCode': 200,
        'body': {
            'success': True,
            'lead_id': lead_id,
            'quality_score': quality_score,
            'grade': get_lead_grade(quality_score)
        }
    }

def email_intent_classification(zia, datastore, data):
    email_body = data.get('email_body', '')
    lead_id = data.get('lead_id', '')
    
    # Zia analysis
    sentiment = zia.get_sentiment_analysis([email_body])
    keywords = zia.get_keyword_extraction([email_body])
    
    # Intent classification
    intent = classify_email_intent(email_body, sentiment, keywords)
    confidence = calculate_intent_confidence(email_body, intent)
    
    # Store classification
    classification_record = {
        'lead_id': lead_id,
        'email_body': email_body,
        'classified_intent': intent,
        'confidence_score': confidence,
        'sentiment': sentiment[0].get('sentiment') if sentiment else 'neutral',
        'keywords': ','.join(keywords[0].get('keywords', [])) if keywords else '',
        'timestamp': catalyst.get_current_time()
    }
    
    datastore.table('email_analysis').insert_row(classification_record)
    
    return {
        'statusCode': 200,
        'body': {
            'success': True,
            'intent': intent,
            'confidence': confidence,
            'recommended_action': get_action_for_intent(intent)
        }
    }

def bulk_lead_analysis(zia, zcql, datastore, data):
    leads = data.get('leads', [])
    results = []
    
    for lead in leads:
        try:
            # Analyze each lead
            lead_text = f"{lead.get('Company', '')} {lead.get('Industry', '')} {lead.get('Designation', '')}"
            sentiment = zia.get_sentiment_analysis([lead_text])
            keywords = zia.get_keyword_extraction([lead_text])
            
            # Calculate scores
            quality_score = predict_lead_quality(lead, sentiment, keywords)
            
            # Update CRM
            if lead.get('lead_id'):
                update_query = f"""
                    UPDATE Leads SET 
                        AI_Quality_Score = {quality_score},
                        Lead_Grade = '{get_lead_grade(quality_score)}'
                    WHERE ROWID = '{lead['lead_id']}'
                """
                zcql.execute_query(update_query)
            
            results.append({
                'lead_id': lead.get('lead_id'),
                'status': 'processed',
                'quality_score': quality_score
            })
            
        except Exception as e:
            results.append({
                'lead_id': lead.get('lead_id'),
                'status': 'error',
                'error': str(e)
            })
    
    return {
        'statusCode': 200,
        'body': {
            'success': True,
            'processed': len(results),
            'results': results
        }
    }

def calculate_urgency(text, keywords):
    urgency_words = ['urgent', 'asap', 'immediately', 'quickly', 'soon', 'deadline']
    urgency_score = 0
    
    text_lower = text.lower()
    for word in urgency_words:
        if word in text_lower:
            urgency_score += 20
    
    return min(100, urgency_score)

def calculate_buying_intent(text, keywords):
    buying_words = ['buy', 'purchase', 'price', 'cost', 'budget', 'demo', 'trial', 'quote']
    intent_score = 0
    
    text_lower = text.lower()
    for word in buying_words:
        if word in text_lower:
            intent_score += 15
    
    return min(100, intent_score)

def predict_lead_quality(lead_data, sentiment, keywords):
    score = 50  # Base score
    
    # Designation scoring
    designation = lead_data.get('Designation', '').lower()
    if 'ceo' in designation or 'founder' in designation:
        score += 30
    elif 'director' in designation or 'vp' in designation:
        score += 25
    elif 'manager' in designation:
        score += 15
    elif 'lead' in designation or 'senior' in designation:
        score += 10
    
    # Industry scoring
    industry = lead_data.get('Industry', '').lower()
    high_value_industries = ['technology', 'manufacturing', 'automotive', 'engineering']
    if any(ind in industry for ind in high_value_industries):
        score += 20
    
    # Company size estimation (based on name patterns)
    company = lead_data.get('Company', '').lower()
    if any(word in company for word in ['tech', 'systems', 'solutions', 'innovations']):
        score += 10
    
    # Sentiment scoring
    if sentiment and sentiment[0].get('sentiment') == 'positive':
        score += 15
    elif sentiment and sentiment[0].get('sentiment') == 'negative':
        score -= 10
    
    return max(0, min(100, score))

def classify_email_intent(email_body, sentiment, keywords):
    text = email_body.lower()
    
    # Unsubscribe intent
    if any(word in text for word in ['unsubscribe', 'remove me', 'stop sending']):
        return 'UNSUBSCRIBE'
    
    # Complaint intent
    if any(word in text for word in ['complaint', 'spam', 'annoying']) or \
       (sentiment and sentiment[0].get('sentiment') == 'negative' and sentiment[0].get('confidence', 0) > 0.8):
        return 'COMPLAINT'
    
    # Positive interest
    if any(word in text for word in ['interested', 'demo', 'schedule', 'meeting', 'call']):
        return 'POSITIVE_INTEREST'
    
    # Need more info
    if any(word in text for word in ['information', 'details', 'pricing', 'features']):
        return 'NEED_MORE_INFO'
    
    # Not interested
    if any(word in text for word in ['not interested', 'no thanks', 'not now']):
        return 'NOT_INTERESTED'
    
    return 'NEED_MORE_INFO'

def calculate_intent_confidence(email_body, intent):
    # Simple confidence calculation based on keyword matches
    confidence_map = {
        'POSITIVE_INTEREST': 0.85,
        'NOT_INTERESTED': 0.90,
        'UNSUBSCRIBE': 0.95,
        'COMPLAINT': 0.80,
        'NEED_MORE_INFO': 0.70
    }
    return confidence_map.get(intent, 0.60)

def get_lead_grade(score):
    if score >= 80:
        return 'A'
    elif score >= 60:
        return 'B'
    elif score >= 40:
        return 'C'
    else:
        return 'D'

def get_action_for_intent(intent):
    actions = {
        'POSITIVE_INTEREST': 'Schedule demo call',
        'NEED_MORE_INFO': 'Send product information',
        'NOT_INTERESTED': 'Add to nurture campaign',
        'COMPLAINT': 'Escalate to support team',
        'UNSUBSCRIBE': 'Remove from all campaigns'
    }
    return actions.get(intent, 'Review manually')