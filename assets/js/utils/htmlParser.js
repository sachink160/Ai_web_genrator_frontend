export class HTMLParser {
    /**
     * Extract CSS from HTML string
     * @param {string} fullHTML - Complete HTML string
     * @returns {string} Extracted CSS
     */
    static extractCSS(fullHTML) {
        if (!fullHTML) return "";
        let extractedCSS = "";
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(fullHTML, "text/html");
            const styleTags = doc.querySelectorAll("style");

            styleTags.forEach((style) => {
                if (style.textContent) {
                    extractedCSS += style.textContent.trim() + "\n";
                }
            });
        } catch (e) {
            console.warn("Error parsing HTML for CSS:", e);
        }
        if (!extractedCSS) {
            const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let match;
            while ((match = styleTagRegex.exec(fullHTML)) !== null) {
                if (match[1]) {
                    extractedCSS += match[1].trim() + "\n";
                }
            }
        }
        return extractedCSS.trim();
    }

    /**
     * Extract body content from full HTML document
     * @param {string} fullHTML - Complete HTML string
     * @returns {string} Body content HTML
     */
    static extractBodyContent(fullHTML) {
        if (!fullHTML) return "";
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(fullHTML, "text/html");
            const body = doc.body;

            if (body && body.innerHTML) {
                return body.innerHTML.trim();
            }
        } catch (e) {
            console.warn("Error parsing HTML body:", e);
        }
        const bodyMatch = fullHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
            return bodyMatch[1].trim();
        }
        return fullHTML.trim();
    }

    /**
     * Combine CSS strings
     * @param {...string} cssStrings - CSS strings to combine
     * @returns {string} Combined CSS
     */
    static combineCSS(...cssStrings) {
        return cssStrings
            .filter((css) => css && css.trim())
            .join("\n\n")
            .trim();
    }

    /**
     * Create full HTML document from body content and CSS
     * @param {string} bodyContent - HTML body content
     * @param {string} css - CSS styles
     * @param {string} title - Page title
     * @returns {string} Complete HTML document
     */
    static createFullHTML(
        bodyContent,
        css = "",
        title = "Generated Landing Page"
    ) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${css ? `<style>${css}</style>` : ""}
</head>
<body>
    ${bodyContent}
</body>
</html>`;
    }
}
