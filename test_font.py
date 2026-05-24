from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000")
        time.sleep(1) # wait for page load and quickstart modal

        # Dismiss quickstart modal if present
        try:
            page.click("#btn-dismiss-quickstart", timeout=2000)
            time.sleep(0.5)
        except:
            pass

        # Take initial screenshot
        page.screenshot(path="screenshot_before.png")

        # Open settings
        page.click(".btn-settings")
        time.sleep(0.5)

        # Change font to Courier New
        page.select_option(".font-family-select", "Courier New")
        time.sleep(0.5)

        # Take screenshot after change
        page.screenshot(path="screenshot_after.png")

        browser.close()

if __name__ == "__main__":
    run()
