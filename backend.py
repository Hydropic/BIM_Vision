#!/usr/bin/env python3

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
from base64 import b64encode

app = Flask(__name__)
CORS(app, origins="*")  # Allow all origins explicitly

# Configuration - use environment variables for security
JIRA_CONFIG = {
    'base_url': os.getenv('JIRA_BASE_URL', 'https://aymansoultana0305.atlassian.net'),
    'email': os.getenv('JIRA_EMAIL', ''),
    'api_token': os.getenv('JIRA_API_TOKEN', ''),
    'project_key': os.getenv('JIRA_PROJECT_KEY', 'CRM')
}

def sanitize_labels(labels):
    """Sanitize labels for Jira - remove spaces and invalid characters"""
    if not labels:
        return []
    
    sanitized = []
    for label in labels:
        if isinstance(label, str):
            # Replace spaces with hyphens, remove special characters
            clean_label = label.replace(' ', '-').replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
            # Remove any remaining invalid characters (keep only alphanumeric, hyphens, underscores)
            clean_label = ''.join(c for c in clean_label if c.isalnum() or c in '-_')
            if clean_label:  # Only add non-empty labels
                sanitized.append(clean_label)
    
    return sanitized

def create_jira_issue(config, issue_data):
    """Create a Jira issue using the REST API"""
    
    # Prepare authentication
    auth_string = f"{config['email']}:{config['api_token']}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = b64encode(auth_bytes).decode('ascii')
    
    # Prepare the issue payload
    jira_issue = {
        "fields": {
            "project": {"key": config['project_key']},
            "summary": issue_data['summary'],
            "description": issue_data['description'],
            "issuetype": {"name": issue_data.get('issue_type', 'Task')},
            "priority": {"name": issue_data.get('priority', 'Medium')},
            "labels": sanitize_labels(issue_data.get('labels', []))
        }
    }
    
    # Add custom field if provided (BCF reference)
    if 'bcf_reference' in issue_data:
        jira_issue['fields']['customfield_10000'] = issue_data['bcf_reference']
    
    # API endpoints to try (v3 first, then v2)
    api_versions = ['3', '2']
    
    headers = {
        'Authorization': f'Basic {auth_b64}',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    
    for version in api_versions:
        url = f"{config['base_url']}/rest/api/{version}/issue"
        
        print(f"Trying Jira API v{version}: {url}")
        
        try:
            response = requests.post(
                url,
                headers=headers,
                data=json.dumps(jira_issue),
                timeout=30
            )
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                issue_key = result['key']
                issue_url = f"{config['base_url']}/browse/{issue_key}"
                
                print(f"✅ Success! Jira issue created: {issue_key}")
                
                return {
                    'success': True,
                    'issue_key': issue_key,
                    'issue_url': issue_url,
                    'api_version': version
                }
            else:
                error_data = response.json() if response.content else {}
                print(f"❌ API v{version} failed with status {response.status_code}")
                
                # If this is the last version to try, return the error
                if version == api_versions[-1]:
                    error_messages = error_data.get('errorMessages', [])
                    error_msg = ', '.join(error_messages) if error_messages else str(error_data)
                    
                    return {
                        'success': False,
                        'error': f"HTTP {response.status_code}: {error_msg}",
                        'details': error_data
                    }
                
                print(f"Trying next API version...")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error for API v{version}: {str(e)}")
            
            # If this is the last version to try, return the error
            if version == api_versions[-1]:
                return {
                    'success': False,
                    'error': f"Request failed: {str(e)}"
                }
    
    return {
        'success': False,
        'error': 'All API versions failed'
    }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    from datetime import datetime
    return jsonify({
        'status': 'OK',
        'service': 'Jira Backend API',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/jira/issue', methods=['POST'])
def create_issue():
    """Create a Jira issue from BCF data"""
    
    try:
        # Check if Jira is configured
        if not JIRA_CONFIG['email'] or not JIRA_CONFIG['api_token']:
            return jsonify({
                'success': False,
                'error': 'Jira credentials not configured. Please set JIRA_EMAIL and JIRA_API_TOKEN environment variables.'
            }), 400
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        # Extract issue data from request
        issue_data = {
            'summary': data.get('summary', 'Issue from BIM Analysis'),
            'description': data.get('description', 'Issue created from BIM data analysis'),
            'issue_type': data.get('issue_type', 'Task'),
            'priority': data.get('priority', 'Medium'),
            'labels': data.get('labels', []),
            'bcf_reference': data.get('bcf_reference')
        }
        
        print(f"Creating Jira issue: {issue_data['summary']}")
        
        # Create the issue
        result = create_jira_issue(JIRA_CONFIG, issue_data)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        print(f"Error in create_issue endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/jira/config', methods=['GET'])
def get_config():
    """Get current Jira configuration (without sensitive data)"""
    return jsonify({
        'base_url': JIRA_CONFIG['base_url'],
        'project_key': JIRA_CONFIG['project_key'],
        'email_configured': bool(JIRA_CONFIG['email']),
        'token_configured': bool(JIRA_CONFIG['api_token'])
    })

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No JSON data provided'
        }), 400

    post = requests.post('https://via.bund.de/bmdv/bim-portal/edu/bim/infrastruktur/api/v1/public/auth/login', headers={'Content-Type': 'application/json'}, data=json.dumps(data), timeout=30)
    return jsonify(post.json(), 200)

@app.route('/api/jira/test', methods=['GET'])
def test_permissions():
    """Test Jira API permissions and project access"""
    try:
        auth_string = f"{JIRA_CONFIG['email']}:{JIRA_CONFIG['api_token']}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = b64encode(auth_bytes).decode('ascii')
        
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        # Test 1: Check if we can access the project
        project_url = f"{JIRA_CONFIG['base_url']}/rest/api/3/project/{JIRA_CONFIG['project_key']}"
        project_response = requests.get(project_url, headers=headers, timeout=30)
        
        # Test 2: Check available projects
        projects_url = f"{JIRA_CONFIG['base_url']}/rest/api/3/project"
        projects_response = requests.get(projects_url, headers=headers, timeout=30)
        
        # Test 3: Check user permissions
        permissions_url = f"{JIRA_CONFIG['base_url']}/rest/api/3/mypermissions"
        permissions_response = requests.get(permissions_url, headers=headers, timeout=30)
        
        result = {
            'project_access': {
                'status': project_response.status_code,
                'accessible': project_response.status_code == 200
            },
            'available_projects': [],
            'permissions': {}
        }
        
        if projects_response.status_code == 200:
            projects_data = projects_response.json()
            result['available_projects'] = [
                {'key': p['key'], 'name': p['name']} 
                for p in projects_data
            ]
        
        if permissions_response.status_code == 200:
            permissions_data = permissions_response.json()
            result['permissions'] = permissions_data.get('permissions', {})
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({
            'error': f'Test failed: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Check configuration on startup
    if not JIRA_CONFIG['email'] or not JIRA_CONFIG['api_token']:
        print("⚠️  Warning: Jira credentials not configured!")
        print("Please set environment variables:")
        print("  export JIRA_EMAIL='your-email@example.com'")
        print("  export JIRA_API_TOKEN='your-api-token'")
        print("  export JIRA_PROJECT_KEY='CRM'")
        print("  export JIRA_BASE_URL='https://aymansoultana0305.atlassian.net'")
    
    print("🚀 Starting Jira Backend API...")
    print(f"Base URL: {JIRA_CONFIG['base_url']}")
    print(f"Project: {JIRA_CONFIG['project_key']}")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
