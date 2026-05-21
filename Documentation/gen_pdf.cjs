const { mdToPdf } = require('md-to-pdf');
const path = require('path');

(async () => {
    try {
        await mdToPdf(
            { path: 'user_guide.md' }, 
            { 
                dest: 'user_guide.pdf',
                pdf_options: { format: 'A4', margin: '20mm' },
                launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
            }
        );
        console.log("PDF successfully generated!");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
