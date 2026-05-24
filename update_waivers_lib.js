const fs = require('fs');

const actionsPath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/lib/actions/waivers.ts';
let actionsCode = fs.readFileSync(actionsPath, 'utf8');

actionsCode = actionsCode.replace(
  'signature_url?: string | null;',
  'signature_url?: string | null;\n    signature_base64?: string | null;'
);

actionsCode = actionsCode.replace(
  'const supabase = await createClient();\r\n\r\n        const payload = {',
  `const supabase = await createClient();

        let signatureUrl = rawData.signature_url || null;

        if (rawData.signature_base64) {
            const base64Data = rawData.signature_base64.replace(/^data:image\\/\\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const timestamp = Date.now();
            const filePath = \`waivers/\${rawData.client_id}/\${timestamp}.png\`;

            const { error: uploadError } = await supabase.storage
                .from('sabbath-spa-assets')
                .upload(filePath, buffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadError) {
                console.error('Signature upload failed:', uploadError);
                return { data: null, error: 'Unable to upload signature. Please try again.' };
            }

            const { data: publicUrlData } = supabase.storage
                .from('sabbath-spa-assets')
                .getPublicUrl(filePath);

            signatureUrl = publicUrlData.publicUrl;
        }

        const payload = {`
);

actionsCode = actionsCode.replace(
  'const supabase = await createClient();\n\n        const payload = {',
  `const supabase = await createClient();

        let signatureUrl = rawData.signature_url || null;

        if (rawData.signature_base64) {
            const base64Data = rawData.signature_base64.replace(/^data:image\\/\\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const timestamp = Date.now();
            const filePath = \`waivers/\${rawData.client_id}/\${timestamp}.png\`;

            const { error: uploadError } = await supabase.storage
                .from('sabbath-spa-assets')
                .upload(filePath, buffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadError) {
                console.error('Signature upload failed:', uploadError);
                return { data: null, error: 'Unable to upload signature. Please try again.' };
            }

            const { data: publicUrlData } = supabase.storage
                .from('sabbath-spa-assets')
                .getPublicUrl(filePath);

            signatureUrl = publicUrlData.publicUrl;
        }

        const payload = {`
);

actionsCode = actionsCode.replace(
  'signature_url: rawData.signature_url || null,',
  'signature_url: signatureUrl,'
);

fs.writeFileSync(actionsPath, actionsCode);

console.log('actions updated');
