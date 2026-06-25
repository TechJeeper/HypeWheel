import sys

with open('/app/index.html', 'r') as f:
    content = f.read()

# Instead of doing sed, I'll use Python to replace the blocks
search_block = """            this.dom.hideInTheater.style.display = "block";
            this.dom.controlsArea.className =
              "controls-area flex flex-col p-4 shrink-0 bg-black/30 backdrop-blur-md w-full lg:w-1/3 border-t lg:border-t-0 lg:border-l border-white/10 transition-all duration-300 h-full overflow-y-auto";
            this.dom.shuffleGrid.className =
              "grid grid-cols-2 gap-2 mt-2 max-w-2xl mx-auto w-full shuffle-grid";
            this.dom.btnSpin.classList.add(
              "max-w-2xl",
              "mx-auto",
              "text-3xl",
              "py-5",
            );"""

replace_block = """            this.dom.hideInTheater.style.display = "block";
            this.dom.controlsArea.className =
              "controls-area flex flex-col p-4 shrink-0 bg-black/30 backdrop-blur-md w-full lg:w-1/3 border-t lg:border-t-0 lg:border-l border-white/10 transition-all duration-300 h-full overflow-y-auto";"""

if search_block in content:
    content = content.replace(search_block, replace_block)
else:
    print("Search block 1 not found")

search_block_2 = """            this.dom.hideInTheater.style.display = "block";
            this.dom.controlsArea.className =
              "controls-area flex flex-col p-4 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-300 dark:border-gray-700 transition-all duration-300 w-full lg:w-96";
            this.dom.shuffleGrid.className =
              "grid grid-cols-2 gap-2 mt-4 shuffle-grid";
            this.dom.btnSpin.classList.remove(
              "max-w-2xl",
              "mx-auto",
              "text-3xl",
              "py-5",
            );"""

replace_block_2 = """            this.dom.hideInTheater.style.display = "block";
            this.dom.controlsArea.className =
              "controls-area flex flex-col p-4 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-300 dark:border-gray-700 transition-all duration-300 w-full lg:w-96";"""

if search_block_2 in content:
    content = content.replace(search_block_2, replace_block_2)
else:
    print("Search block 2 not found")


with open('/app/index.html', 'w') as f:
    f.write(content)

print("Replaced!")
