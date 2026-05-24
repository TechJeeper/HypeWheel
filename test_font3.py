import sys
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000")
        page.wait_for_selector("canvas")

        # Test original logic
        res = page.evaluate("""
            (() => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.font = '800 30px "Courier New", sans-serif';
                return {
                    "dots_width": ctx.measureText("...").width,
                    "ellipsis_width": ctx.measureText("…").width,
                    "Alice_width": ctx.measureText("Alice").width
                };
            })()
        """)
        print(res)
        browser.close()

if __name__ == "__main__":
    main()
