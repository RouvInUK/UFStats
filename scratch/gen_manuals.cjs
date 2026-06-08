const { mdToPdf } = require('md-to-pdf');
const path = require('path');

(async () => {
    try {
        console.log("Compiling root ustats_pro_User_Manual.md...");
        await mdToPdf(
            { path: path.join(__dirname, '../ustats_pro_User_Manual.md') }, 
            { 
                dest: path.join(__dirname, '../ustats_pro_User_Manual.pdf'),
                pdf_options: { format: 'A4', margin: '20mm' },
                launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
            }
        );
        
        console.log("Compiling public/ustats_pro_User_Manual.md...");
        await mdToPdf(
            { path: path.join(__dirname, '../public/ustats_pro_User_Manual.md') }, 
            { 
                dest: path.join(__dirname, '../public/ustats_pro_User_Manual.pdf'),
                pdf_options: { format: 'A4', margin: '20mm' },
                launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
            }
        );
        
        console.log("Manuals successfully compiled to PDF!");
    } catch (err) {
        console.error("Compilation failed:", err);
        process.exit(1);
    }
})();
