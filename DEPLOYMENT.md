# Deploying Tick-Majority Trading App on PythonAnywhere

This guide will walk you through the steps to deploy the Tick-Majority Trading application on PythonAnywhere.

## Prerequisites

- A PythonAnywhere account (free tier is sufficient)
- The files from this repository

## Deployment Steps

### 1. Create a PythonAnywhere Account

If you don't already have one, sign up for a free PythonAnywhere account at [https://www.pythonanywhere.com/](https://www.pythonanywhere.com/).

### 2. Upload Files to PythonAnywhere

There are several ways to upload your files:

#### Option 1: Using the PythonAnywhere Files Interface

1. Log in to your PythonAnywhere account
2. Navigate to the "Files" tab
3. Create a new directory for your project (e.g., `tick-majority`)
4. Upload all the files from this repository to that directory:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `app.py`
   - `requirements.txt`

#### Option 2: Using Git

If your project is in a Git repository:

1. Log in to your PythonAnywhere account
2. Open a Bash console from the "Consoles" tab
3. Clone your repository:
   ```bash
   git clone https://github.com/yourusername/tick-majority.git
   ```

### 3. Set Up a Virtual Environment

1. Open a Bash console from the "Consoles" tab
2. Navigate to your project directory:
   ```bash
   cd tick-majority
   ```
3. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
4. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```
5. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

### 4. Configure a Web App

1. Go to the "Web" tab in PythonAnywhere
2. Click "Add a new web app"
3. Choose your domain name (it will be something like `yourusername.pythonanywhere.com`)
4. Select "Manual configuration"
5. Choose the Python version (3.8 or newer recommended)
6. Set the path to your project directory (e.g., `/home/yourusername/tick-majority`)

### 5. Configure WSGI File

1. In the "Web" tab, look for the link to your WSGI configuration file and click it
2. Replace the contents with the following (adjust paths as needed):

```python
import sys
path = '/home/yourusername/tick-majority'
if path not in sys.path:
    sys.path.append(path)

from app import app as application
```

3. Save the file

### 6. Set Up Static Files

1. In the "Web" tab, scroll down to "Static files"
2. Add the following mappings:
   - URL: `/static/` -> Directory: `/home/yourusername/tick-majority/static`
   - URL: `/` -> Directory: `/home/yourusername/tick-majority`

### 7. Reload Your Web App

1. In the "Web" tab, click the "Reload" button for your web app
2. Wait a few seconds for the changes to take effect

### 8. Visit Your Web App

Your Tick-Majority Trading application should now be accessible at `https://yourusername.pythonanywhere.com/`.

## Troubleshooting

If you encounter any issues:

1. Check the error logs in the "Web" tab
2. Make sure all files are uploaded correctly
3. Verify that your virtual environment has all the required packages installed
4. Ensure the WSGI file is configured correctly

## Notes on WebSocket Support

PythonAnywhere's free tier has limitations on WebSocket connections. The application uses WebSockets to connect to the Deriv API for real-time tick data. If you experience issues with the WebSocket connection:

1. Try using a paid PythonAnywhere account which has better WebSocket support
2. Consider deploying to another platform that fully supports WebSockets (e.g., Heroku, AWS, etc.)

## Updating Your Application

To update your application after making changes:

1. Upload the new files to PythonAnywhere
2. Reload your web app from the "Web" tab
