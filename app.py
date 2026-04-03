import os
import json
import requests
import datetime
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps

# Configure Flask to serve static files from the current directory
app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'bugify-dev-secret-key-123')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db = SQLAlchemy(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

# Auth Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('token')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['user_id']).first()
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Configuration for Gemini API
GEMINI_API_KEY = "AIzaSyAbd8wyXRA_yDqsz43dYhI62mwcV0Yt8ik"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'User already exists'}), 409
    
    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(username=data['username'], password_hash=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully'}), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Invalid username or password'}), 401
    
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    response = make_response(jsonify({'message': 'Login successful', 'username': user.username}))
    response.set_cookie('token', token, httponly=True, samesite='Lax')
    return response

@app.route('/auth/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'message': 'Logged out'}))
    response.set_cookie('token', '', expires=0)
    return response

@app.route('/auth/check', methods=['GET'])
def check_auth():
    token = request.cookies.get('token')
    if not token:
        return jsonify({'authenticated': False}), 200
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        user = User.query.filter_by(id=data['user_id']).first()
        if user:
            return jsonify({'authenticated': True, 'username': user.username}), 200
    except:
        pass
    return jsonify({'authenticated': False}), 200

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
@token_required
def generate_report(current_user): # current_user is passed by the decorator
    data = request.get_json()
    bug_description = data.get('bug')
    
    if not bug_description:
        return jsonify({"error": "No bug description provided"}), 400

    print(f"DEBUG: User {current_user.username} is generating report for: {bug_description[:50]}...")

    # ... REST OF THE FUNCTION REMAINS SAME ...
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
        return jsonify({"error": f"API Error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"AI Generation failed: {str(e)}"}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # Listen on 0.0.0.0 for cloud deployment (Render)
    port = int(os.environ.get('PORT', 5012))
    print(f"AI Bug Reporter is active on port {port}")
    app.run(debug=False, port=port, host='0.0.0.0')
