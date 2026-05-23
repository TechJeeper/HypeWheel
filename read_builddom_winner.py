import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"<!-- WINNER OVERLAY -->(.*?)</div>\s*</div>\s*<!-- CONTROLS -->", content, re.DOTALL)
if m:
    print(m.group(1))
