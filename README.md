# Thai Document Insight

A web app for OCR, analysis, and summarization of Thai real estate and legal documents.  
Supports PDF and image files (JPG, PNG, BMP, TIFF, etc).

---

## 🚀 Features

- **Upload** PDF or image files (JPG, PNG, BMP, TIFF)
- **OCR**: Extracts Thai text with high accuracy using Typhoon API
- **AI Analysis**: Summarizes and classifies document content
- **Download** results as JSON, CSV, or XLSX
- **Modern UI**: Built with React, TypeScript, shadcn-ui, and Tailwind CSS

---

## 🛠️ Installation

### 1. **Clone the repository**

```sh
git clone <YOUR_GIT_URL>
cd thai-doc-insight
```

### 2. **Backend Setup (Python)**

- **Python 3.9+** recommended
- Install dependencies:

```sh
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

- Create a `.env` file in the root directory with:

```
TYPHOON_API_KEY=your_typhoon_api_key_here
SECRET_KEY=your_flask_secret_key_here
```

- **Poppler** is required for PDF support:
  - Download from: https://github.com/oschwartz10612/poppler-windows/releases/
  - Set the `poppler_bin_path` in `app.py` if needed.

- Start the backend:

```sh
python app.py
```

The backend runs on [http://localhost:5000](http://localhost:5000) by default.

---

### 3. **Frontend Setup (React + Vite)**

- **Node.js 18+** recommended

```sh
npm install
npm run dev
```

The frontend runs on [http://localhost:5173](http://localhost:5173) by default.

---

## 📝 Usage Workflow

1. **Upload** a PDF or image file (JPG, PNG, BMP, TIFF) via the web UI.
2. The backend performs OCR and AI analysis on each page.
3. **Review** extracted text and AI-generated summary for each page.
4. **Download** the results as JSON, CSV, or XLSX.

---

## 🧩 Tech Stack

- **Frontend:** React, TypeScript, Vite, shadcn-ui, Tailwind CSS
- **Backend:** Flask, OpenAI-compatible API (Typhoon), pdf2image, pandas, opencv-python, Pillow
- **OCR/AI:** Typhoon API

---

## ⚠️ Notes

- **API Key:** You must have a valid Typhoon API key.
- **File Size Limit:** Max 50MB per upload.
- **Supported Formats:** PDF, JPG, JPEG, PNG, BMP, TIFF, TIF.
- **Poppler:** Required for PDF-to-image conversion.

---

## 🛡️ Security

- **Never commit your `.env` file** or API keys to version control.
- All user-uploaded files are stored in the `uploads/` directory (excluded from git).

---

## 🧑‍💻 Development

- Backend code: [`app.py`](app.py)
- Frontend code: [`src/`](src/)
- Update dependencies as needed in [`requirements.txt`](requirements.txt) and [`package.json`](package.json).

---

## 📄 License

MIT (or your preferred license)

---

## 🤝 Contributing

Pull requests and issues are welcome!

---

## 🌏 Credits

- [Typhoon API](https://opentyphoon.ai/)
- [pdf2image](https://github.com/Belval/pdf2image)
- [shadcn/ui](https://ui.shadcn.com/)
