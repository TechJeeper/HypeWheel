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
                const availableWidth = 70.6;
                let text = "Alice";
                let displayString = text;
                if (ctx.measureText(displayString).width > availableWidth) {
                  while (
                    displayString.length > 0 &&
                    ctx.measureText(displayString + "…").width > availableWidth
                  ) {
                    displayString = displayString.slice(0, -1);
                  }
                  displayString = displayString.length > 0 ? displayString + "…" : "";
                }
                return {
                    "Alice_original": displayString,
                    "Alice_width": ctx.measureText("Alice").width,
                    "dots_width": ctx.measureText("…").width,
                    "Bob_width": ctx.measureText("Bob").width
                };
            })()
        """)
        print(res)
        browser.close()

if __name__ == "__main__":
    main()
