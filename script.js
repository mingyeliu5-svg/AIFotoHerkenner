"use strict";

/* ==========================================
   SUPABASE CONFIGURATIE
========================================== */

/*
    VERVANG DEZE TWEE WAARDEN.

    Je vindt ze in je Supabase-project.

    Gebruik hier je Project URL en
    Publishable Key.

    Zet hier NOOIT je service_role/secret key.
*/

const SUPABASE_URL =
    "https://xhnvriqcvkofxqlsbhgw.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_TnjElC-ZGk_81lnfZH7ACg_d2lPSnOF";


/*
    Supabase client maken.
*/

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );



/* ==========================================
   VERBORGEN PIXELCODE
========================================== */

/*
    Herkenningscode van ons systeem.

    Hiermee weet de decoder dat de gevonden
    informatie waarschijnlijk van ons systeem
    afkomstig is.
*/

const MAGIC =
    new Uint8Array([
        0x41, // A
        0x49, // I
        0x43, // C
        0x31  // 1
    ]);


/*
    Maximale grootte van de identificatiecode.
*/

const MAX_CODE_BYTES = 512;


/*
    Dit zorgt ervoor dat encoder en decoder
    dezelfde pixelposities gebruiken.
*/

const SEED_CONSTANT = 0x0A1C2026;



/* ==========================================
   IDENTIFICATIENUMMER
========================================== */

function generateIdentifier() {

    /*
        Bijvoorbeeld:

        AI-2026-A7C92F14
    */

    const array =
        new Uint8Array(4);

    crypto.getRandomValues(array);


    const randomPart =
        Array.from(array)
            .map(
                byte =>
                    byte
                        .toString(16)
                        .padStart(2, "0")
                        .toUpperCase()
            )
            .join("");


    return `AI-2026-${randomPart}`;
}


/*
    Nieuw identificatienummer in het formulier.
*/

function setNewIdentifier() {

    identifierInput.value =
        generateIdentifier();

}



/* ==========================================
   BYTE FUNCTIES
========================================== */

function concatBytes(...arrays) {

    const totalLength =
        arrays.reduce(
            (sum, array) =>
                sum + array.length,
            0
        );


    const result =
        new Uint8Array(totalLength);


    let offset = 0;


    for (const array of arrays) {

        result.set(
            array,
            offset
        );


        offset += array.length;

    }


    return result;

}


function uint16ToBytes(value) {

    return new Uint8Array([
        (value >>> 8) & 255,
        value & 255
    ]);

}


function uint32ToBytes(value) {

    return new Uint8Array([
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255
    ]);

}



/* ==========================================
   BYTES → BITS
========================================== */

function bytesToBits(bytes) {

    const bits =
        new Array(
            bytes.length * 8
        );


    let position = 0;


    for (const byte of bytes) {

        for (
            let bit = 7;
            bit >= 0;
            bit--
        ) {

            bits[position++] =
                (byte >>> bit) & 1;

        }

    }


    return bits;

}



/* ==========================================
   BITS → BYTES
========================================== */

function bitsToBytes(bits) {

    const byteCount =
        Math.floor(
            bits.length / 8
        );


    const bytes =
        new Uint8Array(
            byteCount
        );


    for (
        let i = 0;
        i < byteCount;
        i++
    ) {

        let value = 0;


        for (
            let bit = 0;
            bit < 8;
            bit++
        ) {

            value =
                (value << 1) |
                bits[i * 8 + bit];

        }


        bytes[i] = value;

    }


    return bytes;

}



/* ==========================================
   CRC32
========================================== */

function crc32(bytes) {

    let crc =
        0xFFFFFFFF;


    for (const byte of bytes) {

        crc ^= byte;


        for (
            let i = 0;
            i < 8;
            i++
        ) {

            const mask =
                -(crc & 1);


            crc =
                (crc >>> 1) ^
                (0xEDB88320 & mask);

        }

    }


    return (
        crc ^
        0xFFFFFFFF
    ) >>> 0;

}



/* ==========================================
   REPRODUCEERBARE PIXELPOSITIE
========================================== */

function initialSeed(
    width,
    height
) {

    let seed =
        (
            (width * 73856093) ^
            (height * 19349663) ^
            SEED_CONSTANT
        ) >>> 0;


    if (seed === 0) {

        seed = 1;

    }


    return seed;

}


function nextRandom(state) {

    state ^= state << 13;

    state ^= state >>> 17;

    state ^= state << 5;

    return state >>> 0;

}


function createPixelPositions(
    width,
    height,
    pixelCount
) {

    const totalPixels =
        width * height;


    if (
        pixelCount >
        totalPixels
    ) {

        throw new Error(
            "De afbeelding bevat te weinig pixels."
        );

    }


    const positions =
        new Array(pixelCount);


    const used =
        new Set();


    let state =
        initialSeed(
            width,
            height
        );


    let index = 0;


    while (
        index <
        pixelCount
    ) {

        state =
            nextRandom(state);


        const position =
            state %
            totalPixels;


        if (
            !used.has(position)
        ) {

            used.add(position);

            positions[index] =
                position;

            index++;

        }

    }


    return positions;

}



/* ==========================================
   LSB VERANDEREN
========================================== */

/*
    We passen maximaal 1 RGB-waarde aan.

    Voorbeeld:

    120 → 121

    Dit verandert slechts één bit:
    de laatste bit van de kleurwaarde.
*/

function setLSB(
    value,
    wantedBit
) {

    if (
        (value & 1) ===
        wantedBit
    ) {

        return value;

    }


    if (
        value === 255
    ) {

        return 254;

    }


    return value + 1;

}



/* ==========================================
   AFBEELDING LADEN
========================================== */

function loadImageFile(file) {

    return new Promise(
        (resolve, reject) => {

            const image =
                new Image();


            const objectURL =
                URL.createObjectURL(
                    file
                );


            image.onload = () => {

                URL.revokeObjectURL(
                    objectURL
                );


                const canvas =
                    document.createElement(
                        "canvas"
                    );


                canvas.width =
                    image.naturalWidth;


                canvas.height =
                    image.naturalHeight;


                const context =
                    canvas.getContext(
                        "2d",
                        {
                            willReadFrequently: true
                        }
                    );


                context.drawImage(
                    image,
                    0,
                    0
                );


                const imageData =
                    context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );


                resolve({
                    canvas,
                    context,
                    imageData
                });

            };


            image.onerror = () => {

                URL.revokeObjectURL(
                    objectURL
                );


                reject(
                    new Error(
                        "De afbeelding kon niet worden geladen."
                    )
                );

            };


            image.src =
                objectURL;

        }
    );

}



/* ==========================================
   FRAME MAKEN
========================================== */

function buildFrame(identifier) {

    const payload =
        new TextEncoder()
            .encode(
                identifier
            );


    if (
        payload.length >
        MAX_CODE_BYTES
    ) {

        throw new Error(
            `Identificatienummer is te lang. Maximum: ${MAX_CODE_BYTES} bytes.`
        );

    }


    const length =
        uint16ToBytes(
            payload.length
        );


    const checksum =
        uint32ToBytes(
            crc32(payload)
        );


    /*
        FRAME:

        MAGIC
        ↓
        lengte
        ↓
        identifier
        ↓
        CRC32
    */

    return concatBytes(
        MAGIC,
        length,
        payload,
        checksum
    );

}



/* ==========================================
   CODE IN AFBEELDING SCHRIJVEN
========================================== */

function embedFrame(
    imageData,
    width,
    height,
    frame
) {

    const bits =
        bytesToBits(
            frame
        );


    /*
        3 bits per pixel:

        R = bit 1
        G = bit 2
        B = bit 3
    */

    const pixelsNeeded =
        Math.ceil(
            bits.length / 3
        );


    const positions =
        createPixelPositions(
            width,
            height,
            pixelsNeeded
        );


    const pixels =
        imageData.data;


    let bitIndex = 0;


    for (
        const pixelNumber
        of positions
    ) {

        const base =
            pixelNumber * 4;


        for (
            let channel = 0;
            channel < 3 &&
            bitIndex < bits.length;
            channel++
        ) {

            pixels[
                base + channel
            ] =
                setLSB(
                    pixels[
                        base + channel
                    ],
                    bits[bitIndex]
                );


            bitIndex++;

        }

    }

}



/* ==========================================
   CODE UIT AFBEELDING LEZEN
========================================== */

function extractBits(
    imageData,
    width,
    height,
    bitCount
) {

    const pixelsNeeded =
        Math.ceil(
            bitCount / 3
        );


    const positions =
        createPixelPositions(
            width,
            height,
            pixelsNeeded
        );


    const pixels =
        imageData.data;


    const bits =
        new Array(
            bitCount
        );


    let bitIndex = 0;


    for (
        const pixelNumber
        of positions
    ) {

        const base =
            pixelNumber * 4;


        for (
            let channel = 0;
            channel < 3 &&
            bitIndex < bitCount;
            channel++
        ) {

            bits[bitIndex++] =
                pixels[
                    base + channel
                ] & 1;

        }

    }


    return bits;

}



function readBytes(
    imageData,
    width,
    height,
    byteCount
) {

    const bits =
        extractBits(
            imageData,
            width,
            height,
            byteCount * 8
        );


    return bitsToBytes(bits);

}



/* ==========================================
   SUPABASE: REGISTREREN
========================================== */

async function registerImage(
    identifier,
    aiSystem,
    model
) {

    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Identifier:", identifier);

    const {
        data,
        error
    } =
        await supabaseClient
            .from("ai_images")
            .insert({
                identifier: identifier,
                ai_system: aiSystem,
                model: model
            })
            .select()
            .single();


    console.log("Data:", data);
    console.log("Error:", error);


    if (error) {

        throw new Error(
            `Supabase fout:
Code: ${error.code || "onbekend"}
Message: ${error.message}
Details: ${error.details || "geen"}
Hint: ${error.hint || "geen"}`
        );

    }


    return data;
}

async function testSupabase() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("ai_images")
            .select("identifier")
            .limit(1);


    if (error) {

        console.error(
            "Supabase verbinding mislukt:",
            error
        );

        return;

    }


    console.log(
        "Supabase verbinding werkt!",
        data
    );
}


testSupabase();



/* ==========================================
   SUPABASE: OPZOEKEN
========================================== */

async function findImage(
    identifier
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("ai_images")
            .select(
                "identifier, ai_system, model, created_at"
            )
            .eq(
                "identifier",
                identifier
            )
            .maybeSingle();


    if (error) {

        throw new Error(
            `Supabase fout bij zoeken:\n${error.message}`
        );

    }


    return data;

}



/* ==========================================
   HTML ELEMENTEN
========================================== */

const imageInput =
    document.getElementById(
        "imageInput"
    );


const aiSystemInput =
    document.getElementById(
        "aiSystemInput"
    );


const modelInput =
    document.getElementById(
        "modelInput"
    );


const identifierInput =
    document.getElementById(
        "identifierInput"
    );


const newIdentifierButton =
    document.getElementById(
        "newIdentifierButton"
    );


const encodeButton =
    document.getElementById(
        "encodeButton"
    );


const downloadButton =
    document.getElementById(
        "downloadButton"
    );


const canvas =
    document.getElementById(
        "canvas"
    );


const checkInput =
    document.getElementById(
        "checkInput"
    );


const checkButton =
    document.getElementById(
        "checkButton"
    );


const result =
    document.getElementById(
        "result"
    );



/* ==========================================
   RESULTAAT FUNCTIES
========================================== */

function showResult(
    message,
    type
) {

    result.textContent =
        message;


    result.className =
        `result ${type}`;

}



/* ==========================================
   NIEUW NUMMER
========================================== */

newIdentifierButton.addEventListener(
    "click",
    () => {

        setNewIdentifier();

    }
);


/*
    Meteen bij het openen een nummer maken.
*/

setNewIdentifier();



/* ==========================================
   CODE VERSTOPPEN
========================================== */

encodeButton.addEventListener(
    "click",
    async () => {

        try {

            const file =
                imageInput.files[0];


            const aiSystem =
                aiSystemInput.value.trim();


            const model =
                modelInput.value.trim();


            const identifier =
                identifierInput.value.trim();


            if (!file) {

                throw new Error(
                    "Kies eerst een afbeelding."
                );

            }


            if (!aiSystem) {

                throw new Error(
                    "Vul het AI-systeem in."
                );

            }


            if (!identifier) {

                throw new Error(
                    "Er is geen identificatienummer."
                );

            }


            encodeButton.disabled =
                true;


            /*
                Afbeelding laden.
            */

            const {
                imageData
            } =
                await loadImageFile(
                    file
                );


            /*
                Canvas instellen.
            */

            canvas.width =
                imageData.width;


            canvas.height =
                imageData.height;


            /*
                Frame maken.
            */

            const frame =
                buildFrame(
                    identifier
                );


            /*
                Controleren of de afbeelding
                genoeg pixels heeft.
            */

            const requiredPixels =
                Math.ceil(
                    (frame.length * 8) / 3
                );


            const availablePixels =
                imageData.width *
                imageData.height;


            if (
                requiredPixels >
                availablePixels
            ) {

                throw new Error(
                    "Deze afbeelding is te klein voor de identificatiecode."
                );

            }


            /*
                Supabase registratie.

                Eerst registreren,
                daarna de code verstoppen.
            */

            await registerImage(
                identifier,
                aiSystem,
                model
            );


            /*
                Code in pixels schrijven.
            */

            embedFrame(
                imageData,
                imageData.width,
                imageData.height,
                frame
            );


            /*
                Gewijzigde afbeelding op canvas zetten.
            */

            const context =
                canvas.getContext(
                    "2d"
                );


            context.putImageData(
                imageData,
                0,
                0
            );


            downloadButton.disabled =
                false;


            showResult(
                "De afbeelding is succesvol geregistreerd.\n\n" +
                `Identificatienummer: ${identifier}\n` +
                `AI-systeem: ${aiSystem}\n` +
                `Model: ${model || "Niet ingevuld"}\n\n` +
                "De identificatiecode is verborgen in de pixels.\n" +
                "Sla de afbeelding op als PNG.",
                "success"
            );

        }

        catch (error) {

            showResult(
                error.message,
                "error"
            );

        }

        finally {

            encodeButton.disabled =
                false;

        }

    }
);



/* ==========================================
   PNG OPSLAAN
========================================== */

downloadButton.addEventListener(
    "click",
    () => {

        if (
            !canvas.width ||
            !canvas.height
        ) {

            return;

        }


        const link =
            document.createElement(
                "a"
            );


        link.download =
            "AI-afbeelding-met-code.png";


        link.href =
            canvas.toDataURL(
                "image/png"
            );


        link.click();

    }
);



/* ==========================================
   AFBEELDING CONTROLEREN
========================================== */

checkButton.addEventListener(
    "click",
    async () => {

        try {

            const file =
                checkInput.files[0];


            if (!file) {

                throw new Error(
                    "Kies eerst een afbeelding."
                );

            }


            checkButton.disabled =
                true;


            showResult(
                "Afbeelding wordt gecontroleerd...",
                "neutral"
            );


            /*
                Afbeelding laden.
            */

            const {
                imageData
            } =
                await loadImageFile(
                    file
                );


            const width =
                imageData.width;


            const height =
                imageData.height;


            /*
                Eerst de header lezen:

                4 bytes MAGIC
                2 bytes lengte
            */

            const header =
                readBytes(
                    imageData,
                    width,
                    height,
                    6
                );


            /*
                MAGIC controleren.
            */

            const correctMagic =
                header[0] === MAGIC[0] &&
                header[1] === MAGIC[1] &&
                header[2] === MAGIC[2] &&
                header[3] === MAGIC[3];


            if (!correctMagic) {

                showResult(
                    "Geen verborgen identificatiecode gevonden.\n\n" +
                    "Deze afbeelding is volgens deze methode niet geregistreerd.",
                    "warning"
                );


                return;

            }


            /*
                Lengte van de identificatie.
            */

            const codeLength =
                (header[4] << 8) |
                header[5];


            if (
                codeLength >
                MAX_CODE_BYTES
            ) {

                throw new Error(
                    "De verborgen code heeft een ongeldige lengte."
                );

            }


            /*
                Hele frame lezen.

                4  = MAGIC
                2  = lengte
                N  = code
                4  = CRC32
            */

            const totalBytes =
                4 +
                2 +
                codeLength +
                4;


            const frame =
                readBytes(
                    imageData,
                    width,
                    height,
                    totalBytes
                );


            /*
                Code eruit halen.
            */

            const payload =
                frame.slice(
                    6,
                    6 + codeLength
                );


            /*
                CRC uitlezen.
            */

            const crcPosition =
                6 + codeLength;


            const storedCRC =
                (
                    (
                        frame[crcPosition] << 24
                    ) >>> 0
                ) |
                (frame[crcPosition + 1] << 16) |
                (frame[crcPosition + 2] << 8) |
                frame[crcPosition + 3];


            /*
                CRC opnieuw berekenen.
            */

            const calculatedCRC =
                crc32(payload);


            /*
                Controle of de code beschadigd is.
            */

            if (
                storedCRC !==
                calculatedCRC
            ) {

                showResult(
                    "Er is een verborgen code gevonden, " +
                    "maar deze is beschadigd.\n\n" +
                    "De afbeelding is waarschijnlijk gewijzigd " +
                    "of opnieuw gecomprimeerd.",
                    "warning"
                );


                return;

            }


            /*
                Bytes → tekst.
            */

            const identifier =
                new TextDecoder()
                    .decode(
                        payload
                    );


            /*
                Zoek identifier op in Supabase.
            */

            const databaseEntry =
                await findImage(
                    identifier
                );


            if (!databaseEntry) {

                showResult(
                    "GELDIGE CODE GEVONDEN\n\n" +
                    `Identificatienummer: ${identifier}\n\n` +
                    "Maar dit nummer staat niet in de database.\n" +
                    "De afbeelding kan dus niet door onze database worden bevestigd.",
                    "warning"
                );


                return;

            }


            /*
                Succesvolle databasecontrole.
            */

            const createdDate =
                new Date(
                    databaseEntry.created_at
                );


            showResult(
                "AI-IDENTIFICATIE GEVONDEN\n\n" +
                `Identificatienummer: ${databaseEntry.identifier}\n` +
                `AI-systeem: ${databaseEntry.ai_system}\n` +
                `Model: ${databaseEntry.model || "Niet ingevuld"}\n` +
                `Registratiedatum: ${createdDate.toLocaleString("nl-NL")}\n\n` +
                "Verborgen code: geldig\n" +
                "Databasecontrole: geldig",
                "success"
            );

        }

        catch (error) {

            showResult(
                error.message,
                "error"
            );

        }

        finally {

            checkButton.disabled =
                false;

        }

    }
);