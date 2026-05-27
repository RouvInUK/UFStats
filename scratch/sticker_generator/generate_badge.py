import os
import urllib.request
import qrcode
from PIL import Image, ImageDraw, ImageFont

import ssl
import subprocess

def download_font(url, dest_path):
    if not os.path.exists(dest_path):
        print(f"Downloading font from {url}...")
        try:
            # Attempt download with unverified SSL context
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(url, context=context) as response, open(dest_path, 'wb') as out_file:
                out_file.write(response.read())
            print("Font downloaded successfully via urllib (unverified SSL).")
        except Exception as e:
            print(f"urllib failed ({e}), falling back to curl...")
            try:
                subprocess.run(["curl", "-L", "-o", dest_path, url], check=True)
                print("Font downloaded successfully via curl.")
            except Exception as curl_err:
                print(f"curl also failed ({curl_err}). Bailing.")
                raise curl_err

def generate_sticker():
    # 1. Paths & Setup
    base_dir = "/Users/rouven/Documents/UFStats"
    logo_path = os.path.join(base_dir, "public/logo_dark.png")
    output_dir = os.path.join(base_dir, "scratch/sticker_generator")
    os.makedirs(output_dir, exist_ok=True)
    
    font_bold_path = os.path.join(output_dir, "Inter-ExtraBold.ttf")
    font_medium_path = os.path.join(output_dir, "Inter-Medium.ttf")
    
    # Download Inter Fonts from official jsDelivr Fontsource CDN
    download_font(
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-800-normal.ttf",
        font_bold_path
    )
    download_font(
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf",
        font_medium_path
    )
    
    # 2. Dimensions & Canvas setup (1200x360 px for 4" x 1.2" @ 300 DPI)
    width = 1200
    height = 360
    
    # Dark charcoal background color (#080c14)
    bg_color = (8, 12, 20) 
    # Teal border color (#17B890)
    teal_color = (23, 184, 144)
    
    sticker_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sticker_img)
    
    # Draw rounded rectangle background (30px radius) with teal border (4px thick)
    radius = 35
    border_thick = 4
    draw.rounded_rectangle(
        [(border_thick, border_thick), (width - border_thick - 1, height - border_thick - 1)],
        radius=radius,
        fill=bg_color,
        outline=teal_color,
        width=border_thick
    )
    
    # 3. Process & Paste Logo Icon (Crop pure shield from logo_dark.png and make it bigger)
    if os.path.exists(logo_path):
        print(f"Loading website logo from: {logo_path}")
        full_logo = Image.open(logo_path).convert("RGBA")
        
        # Extract pure shield logo by cropping rows 10 to 404
        shield_crop = full_logo.crop((10, 10, 707, 404))
        shield_bbox = shield_crop.getbbox()
        shield = shield_crop.crop(shield_bbox)
        print(f"Extracted pure shield emblem. Original cropped size: {shield_crop.size}, active size: {shield.size}")
        
        # Resize shield to fit height (target 260px height for a larger, bolder presence)
        logo_h = 260
        aspect = shield.width / shield.height
        logo_w = int(logo_h * aspect)
        logo_resized = shield.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
        
        # Position logo: 55px from left, centered vertically
        logo_x = 55
        logo_y = (height - logo_h) // 2
        sticker_img.alpha_composite(logo_resized, (logo_x, logo_y))
    else:
        print("Warning: Website logo not found, skipping logo paste.")
        logo_w = 0
        logo_x = 55
        
    # 4. Generate & Paste Functional QR Code pointing to https://ustats.pro
    print("Generating functional QR code for https://ustats.pro...")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data("https://ustats.pro")
    qr.make(fit=True)
    
    # Render QR code: dark charcoal modules on a solid white background (highly scannable)
    qr_img = qr.make_image(fill_color=bg_color, back_color=(255, 255, 255)).convert("RGBA")
    
    # Resize QR code to 210x210 px
    qr_size = 210
    qr_resized = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
    
    # Position QR code: 55px from right (balanced with the logo margin), centered vertically
    qr_x = width - 55 - qr_size
    qr_y = (height - qr_size) // 2
    sticker_img.alpha_composite(qr_resized, (qr_x, qr_y))
    
    # 5. Render Text Elements (ustats.pro and SIDELINE INTELLIGENCE)
    # Centered in the middle space between the large logo and QR code
    content_left = logo_x + logo_w + 35
    content_right = qr_x - 35
    center_x = content_left + (content_right - content_left) // 2
    
    # Load fonts (adjusted sizes to balance visual hierarchy with larger logo)
    font_title_size = 80
    font_tag_size = 20
    font_title = ImageFont.truetype(font_bold_path, font_title_size)
    font_tag = ImageFont.truetype(font_medium_path, font_tag_size)
    
    # Render 'ustats.pro' (lowercase, solid white)
    title_text = "ustats.pro"
    
    # Get bounding box of title text for alignment
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    title_w = title_bbox[2] - title_bbox[0]
    title_h = title_bbox[3] - title_bbox[1]
    
    # Position title: centered horizontally in the content area
    title_x = center_x - (title_w // 2)
    # Align vertically (offset slightly upward to leave space for tagline)
    title_y = (height // 2) - title_h - 10
    
    draw.text((title_x, title_y), title_text, fill=(255, 255, 255, 255), font=font_title)
    
    # Render Tagline 'SIDELINE INTELLIGENCE' (uppercase, Slate color, custom letter-spaced)
    tag_text = "SIDELINE INTELLIGENCE"
    letter_spacing = 6  # px spacing between letters
    slate_color = (148, 163, 184, 255) # #94a3b8
    
    # Calculate custom width with letter spacing
    char_widths = []
    for char in tag_text:
        char_bbox = draw.textbbox((0, 0), char, font=font_tag)
        char_widths.append(char_bbox[2] - char_bbox[0])
    
    total_tag_w = sum(char_widths) + (len(tag_text) - 1) * letter_spacing
    tag_x = center_x - (total_tag_w // 2)
    tag_y = (height // 2) + 25
    
    # Draw character by character
    current_x = tag_x
    for char, char_w in zip(tag_text, char_widths):
        draw.text((current_x, tag_y), char, fill=slate_color, font=font_tag)
        current_x += char_w + letter_spacing
        
    # Save the physical transparent badge PNG
    sticker_path = os.path.join(output_dir, "horizontal_tech_badge_print.png")
    # Also save to public directory so user can easily download it
    public_sticker_path = os.path.join(base_dir, "public/horizontal_tech_badge_print.png")
    
    sticker_img.save(sticker_path, "PNG")
    sticker_img.save(public_sticker_path, "PNG")
    
    print(f"Sticker generated successfully!")
    print(f"Saved to: {sticker_path}")
    print(f"Saved to public: {public_sticker_path}")
    
    return public_sticker_path

if __name__ == "__main__":
    generate_sticker()
