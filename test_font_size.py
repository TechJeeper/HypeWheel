from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:3000")

    # Add a lot of items
    page.fill('.entries-input', '\n'.join([f"Item {i}" for i in range(100)]))
    page.wait_for_timeout(1000)
    page.screenshot(path="screenshot_100_items.png")
    browser.close()
