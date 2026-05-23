import re
with open("index.html", "r") as f:
    content = f.read()

funcs = ["constructor", "showWinner", "closeWinner"]

for func in funcs:
    print(f"--- {func} ---")
    if func == "constructor":
        m = re.search(r"constructor\(config, container\) \{(.*?)\s*parseEntries", content, re.DOTALL)
        if m: print(m.group(1))
    elif func == "showWinner":
        m = re.search(r"showWinner\(\) \{(.*?)\s*\}\s*closeWinner\(\)", content, re.DOTALL)
        if m: print(m.group(1))
    elif func == "closeWinner":
        m = re.search(r"closeWinner\(\) \{(.*?)\s*\}\s*setTheaterMode", content, re.DOTALL)
        if m: print(m.group(1))
