import re
with open("index.html", "r") as f:
    content = f.read()

m = re.search(r"this\.dom = \{(.*?)\};", content, re.DOTALL)
if m:
    print("--- this.dom ---")
    print(m.group(1))

m2 = re.search(r"bindEvents\(\) \{(.*?)\s*updateUIState", content, re.DOTALL)
if m2:
    print("--- bindEvents ---")
    print(m2.group(1))
