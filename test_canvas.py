import urllib.request
import os
import time

from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(storage_state={"cookies": [], "origins": [{"origin": "http://localhost:3000", "localStorage": [{"name": "hideQuickStart", "value": "true"}]}]})
        page = context.new_page()
        page.goto("http://localhost:3000/")
        page.wait_for_selector(".wheel-canvas", state="visible")
        time.sleep(1)
        page.screenshot(path="canvas_after.png")

        # open settings
        page.click(".btn-settings")
        page.wait_for_selector(".custom-text-color-input", state="visible")
        page.screenshot(path="settings_after.png")

        browser.close()

verify()
