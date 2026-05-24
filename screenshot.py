from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto("http://localhost:3000")

    # Wait for the page to load
    time.sleep(1)

    # Close quickstart modal if it's there
    try:
        page.click("#btn-close-quickstart", timeout=1000)
        time.sleep(0.5)
    except:
        pass

    page.screenshot(path="verify-header.png")

    # Open the import/export modal
    page.click("#btn-open-import-export-modal")
    time.sleep(0.5)
    page.screenshot(path="verify-modal.png")

    browser.close()
