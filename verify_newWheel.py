import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"document\.getElementById\('btn-add-wheel'\)\.addEventListener\('click', \(\) => \{(.*?)\}\);", content, re.DOTALL)
if m:
    print(m.group(0))
