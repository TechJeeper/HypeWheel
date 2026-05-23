import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"let appState = \{.*?\};(.*?)(const saveState)", content, re.DOTALL)
if m:
    print(m.group(0))

m2 = re.search(r"const newWheel = \{(.*?)\};", content, re.DOTALL)
if m2:
    print(m2.group(0))
