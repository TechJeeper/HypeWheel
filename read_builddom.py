import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"buildDOM\(\) \{.*?<!-- SETTINGS -->(.*?)<!-- MAIN AREA -->", content, re.DOTALL)
if m:
    print(m.group(1))
