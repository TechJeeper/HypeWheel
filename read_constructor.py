import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"constructor\(config, container\) \{(.*?)\s*parseEntries", content, re.DOTALL)
if m:
    print(m.group(1))
