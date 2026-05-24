import sys
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # We need to dismiss the Quick Start Guide
        page.evaluate("localStorage.setItem('hideQuickStart', 'true');")
        page.reload()

        page.wait_for_selector("canvas")

        page.evaluate("""
            const inst = wheelInstances[0];
            inst.fontFamily = "Courier New";
            inst.rawText = "Alice\\nBob\\nCharlie\\nDave\\nEve\\nFrank\\nBob\\nEve";
            inst.entries = inst.parseEntries(inst.rawText);
            inst.draw();
        """)

        page.screenshot(path="screenshot_user.png")
        print("Screenshot saved to screenshot_user.png")
        browser.close()

if __name__ == "__main__":
    main()
