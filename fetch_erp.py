import urllib.request

base_url = "https://newerp.kluniversity.in"

try:
    with urllib.request.urlopen(base_url + "/index.php") as response:
        html = response.read().decode('utf-8')
        
        # Rewrite relative URLs to absolute URLs for resources and captcha
        html = html.replace('href="/', f'href="{base_url}/')
        html = html.replace('src="/', f'src="{base_url}/')
        html = html.replace('action="/', f'action="{base_url}/')
        html = html.replace('value="/', f'value="{base_url}/')
        
        # Also fix the yiiCaptcha refresh URL and hash matching script
        html = html.replace('"\\/index.php', f'"{base_url}/index.php')
        html = html.replace("url = \"/index.php", f"url = \"{base_url}/index.php")
        
        # Disable yiiCaptcha hash check on the client-side so it accepts any code for visual testing
        import re
        html = re.sub(
            r'yii\.validation\.captcha\(value, messages, \{"hash":\d+,"hashKey":"yiiCaptcha\\/site\\/captcha","caseSensitive":false,"message":".*?"\}\);',
            r"// yii.validation.captcha removed for local form test bypass",
            html
        )
        
        # Add auto-refresh to the captcha when loaded
        auto_refresh_script = """
    window.addEventListener('load', function () {
        document.documentElement.style.visibility = 'visible';
        
        // Auto-refresh captcha on fresh load and make it clickable to refresh again
        var captchaImage = document.getElementById('loginFormCaptcha-image');
        if (captchaImage) {
            // Force a reload by clicking it when the page loads
            setTimeout(function() {
                captchaImage.click();
            }, 300);
            
            // Allow manual click to refresh with a new random query param to bust cache
            captchaImage.onclick = function() {
                this.src = "https://newerp.kluniversity.in/index.php?r=site%2Fcaptcha&v=" + Math.random();
            };
        }
    });
"""
        html = html.replace("    window.addEventListener('load', function () {\n        document.documentElement.style.visibility = 'visible';\n    });\n", auto_refresh_script)
        html = html.replace("    window.addEventListener('load', function () {\r\n        document.documentElement.style.visibility = 'visible';\r\n    });\r\n", auto_refresh_script)
         
        with open("erp_login.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Successfully saved to erp_login.html with fixed URLs")
except Exception as e:
    print(f"Error: {e}")
