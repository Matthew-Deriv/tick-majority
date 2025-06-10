# Deploying to PythonAnywhere

This guide will help you deploy the Tick-Majority Trading application to PythonAnywhere.

## Prerequisites

- A PythonAnywhere account (free tier is sufficient)
- The files from this repository

## Step 1: Create a PythonAnywhere Account

If you don't already have one, sign up for a free PythonAnywhere account at [https://www.pythonanywhere.com/](https://www.pythonanywhere.com/).

## Step 2: Upload Your Files

1. Log in to your PythonAnywhere account
2. Go to the "Files" tab
3. Create a new directory for your application (e.g., `tick-majority`)
4. Upload all the files from this repository to that directory:
   - `app.py`
   - `index.html`
   - `styles.css`
   - `app.js`
   - `requirements.txt`

## Step 3: Set Up a Virtual Environment

1. Go to the "Consoles" tab
2. Start a new Bash console
3. Navigate to your project directory:
   ```bash
   cd tick-majority
   ```
4. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
5. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```
6. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Step 4: Configure a Web App

1. Go to the "Web" tab
2. Click "Add a new web app"
3. Choose "Manual configuration"
4. Select the Python version (3.8 or newer)
5. Enter the path to your project directory (e.g., `/home/yourusername/tick-majority`)
6. Configure the WSGI file:
   - Click on the WSGI configuration file link
   - Replace the contents with the following:

```python
import sys
import os

# Add your project directory to the Python path
path = '/home/yourusername/tick-majority'
if path not in sys.path:
    sys.path.append(path)

# Set the path to your virtual environment
os.environ['VIRTUAL_ENV'] = '/home/yourusername/tick-majority/venv'
os.environ['PATH'] = '/home/yourusername/tick-majority/venv/bin:' + os.environ['PATH']

# Import your Flask app
from app import app as application
```

7. Replace `yourusername` with your actual PythonAnywhere username
8. Save the file

## Step 5: Configure Static Files

1. In the "Web" tab, scroll down to the "Static Files" section
2. Add the following static file mappings:
   - URL: `/styles.css`, Directory: `/home/yourusername/tick-majority/styles.css`
   - URL: `/app.js`, Directory: `/home/yourusername/tick-majority/app.js`
3. Replace `yourusername` with your actual PythonAnywhere username

## Step 6: Reload Your Web App

1. Go back to the top of the "Web" tab
2. Click the "Reload" button for your web app

## Step 7: Access Your Application

Your application should now be available at:
```
https://yourusername.pythonanywhere.com
```

Replace `yourusername` with your actual PythonAnywhere username.

## Troubleshooting

If you encounter any issues:

1. Check the error logs in the "Web" tab
2. Make sure all files have been uploaded correctly
3. Verify that the paths in the WSGI configuration file are correct
4. Ensure that the static file mappings are set up properly
5. Check that the virtual environment has been created and activated correctly
