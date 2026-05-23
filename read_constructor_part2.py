import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"this\.entries = this\..*?(parseEntries.*?\})", content, re.DOTALL)
if m:
    print(m.group(0))
