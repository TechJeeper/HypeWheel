1. **Analyze Security Issue:**
   - The issue is Stored XSS in the Winners List. When displaying winners, `w.winnerName` and `w.wheelTitle` are interpolated directly into the innerHTML without sanitization/escaping.
   - An attacker could enter malicious input as their entry name, or a malicious wheel title, which gets executed when the winner is displayed or when the UI is refreshed.

2. **Add global `escapeHTML` function:**
   - Add a global `escapeHTML` function right after the `easeOutQuart` function in `index.html`.
     ```javascript
     const escapeHTML = (str) => {
         if (typeof str !== 'string') return str;
         return str.replace(/[&<>'"]/g,
             tag => ({
                 '&': '&amp;',
                 '<': '&lt;',
                 '>': '&gt;',
                 "'": '&#39;',
                 '"': '&quot;'
             }[tag] || tag)
         );
     };
     ```

3. **Verify adding `escapeHTML`:**
   - Use `cat index.html | grep -n "escapeHTML"` to verify the function was added correctly.

4. **Update `updateWinnersUI` function in `index.html`:**
   - Modify the `w.winnerName` and `w.wheelTitle` interpolations to use `escapeHTML(w.winnerName)` and `escapeHTML(w.wheelTitle)` inside the `appState.winners.map` function.

5. **Verify `updateWinnersUI` changes:**
   - Use `cat index.html | grep -n -A 10 "w.winnerName"` to confirm the interpolation was updated correctly.

6. **Update `showToast` in `index.html`:**
   - Update `showToast` to `escapeHTML(message)` so that when toasts contain user inputs (e.g., `showToast(\`\${this.winnerName} removed!\`)`), it is safe from XSS.

7. **Verify `showToast` changes:**
   - Use `cat index.html | grep -n "toast.innerHTML"` to confirm the escaping logic was added.

8. **Update `buildDOM` in `index.html`:**
   - Escape values like `this.title` and `this.centerImage` before placing them into `wrapper.innerHTML`.

9. **Verify `buildDOM` changes:**
   - Use `cat index.html | grep -n "this.title"` to confirm the properties were properly escaped in the DOM construction.

10. **Run full test suite:**
    - Execute `./test_plan.sh` to ensure the security fix does not introduce regressions or break existing tests.

11. **Complete pre commit steps:**
    - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.

12. **Submit:**
    - Create PR with security issue details.
