# app.py

import os
import json
import pickle
import base64
from io import BytesIO
import time
import threading
import hashlib
import re # Ensure the regular expression module is imported
import textwrap
import html
from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
from openai import OpenAI
import pandas as pd
from pdf2image import convert_from_path
from dotenv import load_dotenv
from PIL import Image
import cv2
import numpy as np
from werkzeug.utils import secure_filename

# --- Poppler Path Setup ---
poppler_bin_path = r"C:\poppler-24.08.0\Library\bin"
if poppler_bin_path not in os.environ.get('PATH', ''):
    os.environ['PATH'] += os.pathsep + poppler_bin_path
    print(f"DEBUG: Successfully added Poppler to PATH: {poppler_bin_path}")

# --- Environment and API Setup ---
load_dotenv()
TYPHOON_API_KEY = os.getenv('TYPHOON_API_KEY')
if not TYPHOON_API_KEY:
    raise ValueError("TYPHOON_API_KEY must be set in the .env file.")

client = OpenAI(base_url="https://api.opentyphoon.ai/v1", api_key=TYPHOON_API_KEY)

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this')
CORS(app, supports_credentials=True)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Rate Limiter, Caching, and Image Enhancement (Unchanged) ---
class RateLimiter:
    def __init__(self, requests_per_minute):
        self.interval = 60.0 / requests_per_minute if requests_per_minute > 0 else 0
        self.lock = threading.Lock()
        self.last_request_time = 0
    def wait(self):
        if self.interval == 0: return
        with self.lock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.interval:
                sleep_time = self.interval - time_since_last
                print(f"DEBUG: Rate limiting. Sleeping for {sleep_time:.2f} seconds.")
                time.sleep(sleep_time)
            self.last_request_time = time.time()

class SimpleCache:
    def __init__(self, cache_file="typhoon_cache.pkl"):
        self.cache_file = os.path.join(UPLOAD_FOLDER, cache_file); self.cache = {}; self._load_cache()
    def _load_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "rb") as f: self.cache = pickle.load(f)
            except Exception as e:
                print(f"DEBUG: Could not load cache: {e}"); self.cache = {}
    def _save_cache(self):
        try:
            with open(self.cache_file, "wb") as f: pickle.dump(self.cache, f)
        except Exception as e:
            print(f"DEBUG: Could not save cache: {e}")
    def get_response(self, client_instance, model, messages, **kwargs):
        key_dict = {"model": model, "messages": messages, **kwargs}
        if 'image_url' in str(messages):
             key_dict['messages'] = str(messages)
        key = hashlib.md5(json.dumps(key_dict, sort_keys=True).encode()).hexdigest()
        if key in self.cache:
            print(f"DEBUG: Using cached response for key {key}"); return self.cache[key]
        print(f"DEBUG: No cache found for key {key}. Making new API call.")
        response = client_instance.chat.completions.create(model=model, messages=messages, **kwargs)
        self.cache[key] = response; self._save_cache(); return response

api_cache = SimpleCache()
ocr_rate_limiter = RateLimiter(requests_per_minute=20)
instruct_rate_limiter = RateLimiter(requests_per_minute=200)

def enhance_image(pil_image: Image.Image) -> Image.Image:
    open_cv_image = np.array(pil_image)
    if len(open_cv_image.shape) == 3: gray = cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2GRAY)
    else: gray = open_cv_image
    upscaled = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    _, thresh = cv2.threshold(upscaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(thresh)

# --- WORKFLOW FUNCTIONS (Transcription is unchanged, Analysis is fixed) ---

def transcribe_image_with_typhoon(pil_image: Image.Image):
    """Stage 1: Transcribes a PIL image with robust JSON parsing."""
    print("DEBUG: Stage 1 - Enhancing and transcribing image...")
    enhanced_image = enhance_image(pil_image)
    buffered = BytesIO(); enhanced_image.save(buffered, format="PNG")
    image_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    custom_prompt = f"""
You are an expert-level OCR engine specializing in Thai legal and real estate documents. Your primary goal is to transcribe the text from the image with the highest possible accuracy.

**CRITICAL INSTRUCTIONS:**
1.  **Be Meticulous:** Pay extremely close attention to details, especially numbers, dates, legal terms, and proper nouns.
2.  **Correct Common Errors:** Use the following examples to guide your transcription. Apply these principles to any similar errors you encounter.
    - **Misinterpreted Characters:**
        - BAD: `ระยะฉลามเน็ต` -> GOOD: `กระจกลามิเนต`
        - BAD: `200 มิลลิเมตร % 200 มิลลิเมตร` -> GOOD: `200 มิลลิเมตร x 200 มิลลิเมตร`
    - **Incorrect Technical Terms:**
        - BAD: `69.3 เดชิเบล (A加权)` -> GOOD: `69.3 เดซิเบล (เอ)`
        - BAD: `ค่าระดับเสียงเฉลี่ย (Leq) 24 ชั่วโมง เท่ากับ 69.3 (B(A加权)` -> GOOD: `กำหนดให้มีค่าระดับเสียงเฉลี่ย (Leq) 24 ชั่วโมง เท่ากับ 70 dB(A))`
3.  **Preserve Formatting:** Maintain the original structure of the text, including line breaks and paragraphs.
4.  **Final Output Format:** Your entire response MUST be a single, valid JSON object with one key: `natural_text`. The value should be the complete, corrected transcription.

Example Output:
`{{ "natural_text": "ข้อ 2. ข้อตกลงจะซื้อจะขาย\\n2.1 ผู้จะขายตกลงจะขายและผู้จะซื้อตกลงจะซื้อห้องชุดในอาคารชุด..." }}`

Now, transcribe the document in the provided image.
"""
    messages = [{"role": "user", "content": [{"type": "text", "text": custom_prompt}, {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}}]}]
    
    raw_output = ""
    try:
        ocr_rate_limiter.wait()
        response = api_cache.get_response(client, model="typhoon-ocr-preview", messages=messages, max_tokens=4096, temperature=0.0)
        raw_output = response.choices[0].message.content
        match = re.search(r'\{.*\}', raw_output, re.DOTALL)
        if match:
            json_string = match.group(0)
            result = json.loads(json_string)
            print("DEBUG: Stage 1 - Transcription successful.")
            return result['natural_text']
        else:
            raise ValueError("No JSON object found in the model's response.")
    except Exception as e:
        print(f"DEBUG: Error in Stage 1 (Transcription): {e}")
        raise ValueError(f"Failed to parse transcription. Raw model output: '{raw_output}'")

# --- THIS IS THE CORRECTED AND IMPROVED FUNCTION ---
def analyze_text_with_typhoon(transcribed_text: str):
    """Stage 2: Analyzes transcribed text with robust JSON parsing."""
    print("DEBUG: Stage 2 - Analyzing transcribed text...")

    # REFINED SYSTEM PROMPT: More direct instructions to prevent extra text.
    system_prompt = """
You are a highly specialized AI analyst for real estate documents. Your task is to meticulously analyze the provided text and return a single, valid JSON object with NO additional text or markdown.

The JSON object must have exactly three keys: `transcribed_contents`, `optimized_details`, and `is_important`.

**RULE 1: `transcribed_contents`**
- The value MUST be the full, original input text you received. Do not alter, translate, or omit anything.

**RULE 2: `optimized_details`**
- The value MUST be a concise summary **in Thai**, limited to 1-2 sentences.
- The summary's purpose is to capture the essence of the text while preserving critical data.
- You MUST retain:
    - **All numerical values:** Prices (e.g., 1,990,000.00 บาท), dates (e.g., 22 มิถุนายน 2568), measurements (e.g., 27.10 ตารางเมตร), and quantities.
    - **Key technical details:** Material names (e.g., กระจกลามิเนต), legal references (e.g., พ.ร.บ.ควบคุมอาคาร พ.ศ.2522), and specific identifiers (e.g., ห้องชุดเลขที่ A0201).
- The summary MUST be faithful to the original meaning. If foreign terms like 'Exclusive' appear, clarify their meaning based on the context.

**RULE 3: `is_important`**
- The value MUST be a boolean (`true` or `false`).
- To determine the value, evaluate the text against the following **Classified Information Checklist**. If the text contains specific details from ANY of these categories, you MUST set `is_important` to `true`.

**--- Classified Information Checklist ---**
- **A. Pricing & Financials:** Does it mention specific, non-public financial figures?
    - Examples: Purchase prices (`ราคาจะซื้อจะขาย 1,980,000.00 บาท`), construction costs, specific payment amounts (`ชำระในวันทำสัญญา 999.00 บาท`), internal budgets.
- **B. Legal & Contractual Specifics:** Does it mention binding legal terms between parties?
    - Examples: Specific contract clauses (e.g., `ข้อตกลงตามเอกสารแนบท้ายสัญญา`), names of contracting parties (`ผู้จะซื้อและผู้จะขาย`), specific legal dates, or non-public land parcel IDs.
- **C. Detailed Engineering Specs:** Does it mention specific, non-generic technical details?
    - Examples: Exact room dimensions, specific model numbers (`A0201`), material specifications beyond common knowledge, noise level ratings.
- **D. Internal Processes:** Does it refer to internal plans, non-public agreements, or project-specific compliance?
    - Examples: References to internal approvals, partnerships, or specific EIA report data (not just general law).

- **FINAL DECISION:** If the text contains information matching A, B, C, or D, return `is_important: true`. If it only contains general, publicly-known information, return `is_important: false`.

Your response MUST be the JSON object and nothing else.
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": transcribed_text}
    ]

    raw_output = "" # Initialize for error logging
    try:
        instruct_rate_limiter.wait()
        response = api_cache.get_response(
            client,
            model="typhoon-v2.1-12b-instruct",
            messages=messages,
            temperature=0.1,
            max_tokens=2048 # Increased tokens slightly for safety with large inputs
        )

        raw_output = response.choices[0].message.content.strip()
        print(f"DEBUG: Raw analysis response from Typhoon:\n---\n{raw_output}\n---")

        # ROBUST JSON EXTRACTION: Find the JSON block using regex
        match = re.search(r'\{.*\}', raw_output, re.DOTALL)
        
        if match:
            json_string = match.group(0)
            print("DEBUG: Successfully extracted JSON string from response.")
            # Now, parse the extracted, clean JSON string
            parsed_json = json.loads(json_string)
            
            # Final validation to ensure all keys are present
            if all(k in parsed_json for k in ['transcribed_contents', 'optimized_details', 'is_important']):
                 print("DEBUG: JSON parsed and validated successfully.")
                 return parsed_json
            else:
                raise ValueError("Parsed JSON is missing one or more required keys.")
        else:
            # This will be triggered if the model returns no JSON at all
            print("DEBUG: No JSON object found in the model's response. Returning raw output as fallback.")
            # Fallback for the rare case the model completely fails to produce JSON
            return {
                "transcribed_contents": transcribed_text,
                "optimized_details": f"Analysis failed. Raw model output: {raw_output}",
                "is_important": True # Mark as important for manual review
            }

    except Exception as e:
        # This will catch API errors, json.loads errors, or our custom ValueErrors
        print(f"DEBUG: Error in Stage 2 (Analysis): {e}")
        # The error message now includes the raw output for easier debugging
        return {
            "transcribed_contents": transcribed_text,
            "optimized_details": f"Error during analysis: {e}. Raw model output: '{raw_output}'",
            "is_important": True # Mark as important for manual review
        }

# --- API Routes for Frontend (Unchanged) ---
@app.route('/api/upload', methods=['POST'])
def api_upload():
    try:
        if 'pdf_file' not in request.files: return jsonify({'error': 'No file part'}), 400
        file = request.files['pdf_file']
        if file.filename == '': return jsonify({'error': 'No selected file'}), 400
        if not file.filename.lower().endswith('.pdf'): return jsonify({'error': 'Please upload a PDF file only'}), 400
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        session['filename'] = filename
        session['file_path'] = file_path
        return jsonify({'success': True, 'filename': filename, 'message': 'File uploaded successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract', methods=['GET'])
def api_extract():
    try:
        filename = session.get('filename')
        file_path = session.get('file_path')
        if not filename or not file_path:
            return jsonify({'error': 'No file specified for extraction'}), 400
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        images = convert_from_path(file_path)
        pages_data = []
        for page_num, image in enumerate(images, 1):
            try:
                # Stage 1: OCR
                transcribed_text = transcribe_image_with_typhoon(image)
                # Stage 2: Analysis
                analysis_result = analyze_text_with_typhoon(transcribed_text)
                # Compose final result for this page - now with clean data
                pages_data.append({
                    'page_number': page_num,
                    'analyze_contents': analysis_result.get('transcribed_contents', transcribed_text), # Fallback to original text
                    'optimized_details': analysis_result.get('optimized_details'),
                    'is_important': analysis_result.get('is_important'),
                })
            except Exception as e:
                pages_data.append({
                    'page_number': page_num,
                    'analyze_contents': f"Error processing this page: {str(e)}",
                    'optimized_details': "Error",
                    'is_important': True,
                })
        
        # Store comprehensive data for download, not just minimal data
        session['pages_data'] = pages_data

        return jsonify({'success': True, 'pages_data': pages_data, 'total_pages': len(pages_data)})
    except Exception as e:
        print(f"Error during extraction: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/<file_format>')
def api_download(file_format):
    try:
        # We need to reconstruct the dataframe from the detailed pages_data
        pages_data_full = session.get('pages_data')
        if not pages_data_full: return jsonify({'error': 'No data to download'}), 400
        
        # Prepare data for export, ensuring only relevant columns are included
        export_data = [{
            'page_number': page.get('page_number'),
            'transcribed_contents': page.get('analyze_contents'),
            'optimized_details': page.get('optimized_details'),
            'is_important': page.get('is_important')
        } for page in pages_data_full]

        output = BytesIO()
        base_filename = session.get('filename', 'analysis_results').replace('.pdf', '')
        
        if file_format == 'xlsx':
            df = pd.DataFrame(export_data)
            df.to_excel(output, index=False, sheet_name='Analysis')
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            download_name = f'{base_filename}.xlsx'
        elif file_format == 'csv':
            df = pd.DataFrame(export_data)
            df.to_csv(output, index=False, encoding='utf-8')
            mimetype = 'text/csv'
            download_name = f'{base_filename}.csv'
        elif file_format == 'json':
            json_data = json.dumps(export_data, indent=4, ensure_ascii=False)
            output.write(json_data.encode('utf-8'))
            mimetype = 'application/json'
            download_name = f'{base_filename}.json'
        else:
            return jsonify({'error': 'Invalid file format specified'}), 400
        
        output.seek(0)
        return send_file(output, download_name=download_name, as_attachment=True, mimetype=mimetype)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)