import os
import json
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load key from .env file
load_dotenv()

# Configure Flask to serve static files from the current directory
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Configuration for Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

def generate_with_gemini(prompt):
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": "You are a senior software engineer and QA expert. Return only valid JSON without any markdown formatting.\n\n" + prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    response = requests.post(GEMINI_URL, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(content)

@app.route('/')
def home():
    # Serve index.html as the default landing page
    return send_from_directory('.', 'index.html')

@app.route('/generate', methods=['POST'])
def generate_report():
    data = request.get_json()
    bug_description = data.get('bug')
    
    if not bug_description:
        return jsonify({"error": "No bug description provided"}), 400

    print(f"DEBUG: Generating report using Gemini for: {bug_description[:50]}...")

    # The prompt logic provided by the user
    prompt = f"""
    Analyze this raw bug description and generate a complete, professional, and structured bug report.

    Bug Description:
    \"\"\"{bug_description}\"\"\"

    Instructions:
    - Improve clarity and fill missing technical details if needed.
    - Think step-by-step like a real engineer debugging the issue.
    - Return ONLY a valid JSON object following this format:

    {{
        "improved_description": "...",
        "title": "...",
        "summary": "...",
        "steps": ["step 1", "step 2", ...],
        "expected_result": "...",
        "actual_result": "...",
        "possible_root_causes": ["cause 1", "cause 2", ...],
        "debugging_steps": ["step 1", "step 2", ...],
        "suggested_fixes": ["fix 1", "fix 2", ...],
        "severity": "Low/Medium/High/Critical",
        "priority": "Low/Medium/High",
        "impact_reason": "..."
    }}

    Keep the tone professional and developer-friendly.
    """

    try:
        # Calling the Gemini API using requests
        report_data = generate_with_gemini(prompt)
        return jsonify(report_data)
        
    except requests.exceptions.HTTPError as e:
        # Hide the URL (which contains the API key) from the user error message
        status_code = e.response.status_code
        reason = e.response.reason
        return jsonify({"error": f"API Error: {status_code} {reason}. Please try again later."}), status_code
    except Exception as e:
        # Hide the full traceback and just show the error message
        return jsonify({"error": f"AI Generation failed: {str(e)}"}), 500

if __name__ == '__main__':
    # Listen on 0.0.0.0 for cloud deployment (Render)
    port = int(os.environ.get('PORT', 5012))
    print(f"AI Bug Reporter is active on port {port}")
    app.run(debug=False, port=port, host='0.0.0.0')
