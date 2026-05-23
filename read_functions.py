import re
with open("index.html", "r") as f:
    content = f.read()

funcs = ["saveConfig", "buildDOM", "bindEvents", "showWinner", "closeWinner"]

for func in funcs:
    print(f"--- {func} ---")
    matches = re.finditer(r"\s+(" + func + r"\s*\(.*?\)\s*\{)", content)
    for m in matches:
        start_idx = m.start()
        # extract roughly the next 200 chars or find closing brace
        print(content[start_idx:start_idx+500])
        print("...")
