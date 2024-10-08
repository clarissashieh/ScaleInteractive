import styles from './scale.module.css' with {type: 'css'};
import html from './scale.module.html';
import { Synthesizer } from '@tunepad/audio';

export class Scale extends HTMLElement {

    static readonly ELEMENT = "music-scale";

    static observedAttributes = [
        'min-value',
        'max-value',
        'value'
    ];

    /// all of the HTML elements are contained in a shadow DOM
    root : ShadowRoot;

    /// <svg> tag that contains the interactive
    container : SVGSVGElement | null = null;

    /// group that contains all of the visual elements
    parent : SVGGElement = document.createElementNS("http://www.w3.org/2000/svg", 'g');

    /// synthesizer for note audio
    private synth : Synthesizer = new Synthesizer;

    /// current state
    static isMajor = true;
    static startNote : number = 0;

    /// scale notes
    static readonly NOTES = ["C", "D", "E", "F", "G", "A", "B"];
    static ACCIDENTALS : string[];

    /// corresponding MIDI numbers
    static readonly MIDI = [60, 62, 64, 65, 67, 69, 71, 72];

    /// MIDI patterns for major and minor scales
    static readonly MAJOR : number[] = [0, 2, 4, 5, 7, 9, 11, 12];
    static readonly MINOR : number[] = [0, 2, 3, 5, 7, 8, 10, 12];

    /// note wheel element
    private wheel : NoteWheel | null = null;

    /// current note sound
    private currNoteSound : number = -1;

    /// button element
    private button : MajMinButton | null = null;
    constructor() {
        super();
        this.root = this.attachShadow({ mode: 'open' });
        this.root.adoptedStyleSheets.push(styles);
        this.root.innerHTML = html;
    }

    connectedCallback() {
        // load the container <svg> element from the shadow dom
        this.container = (this.root.querySelector("svg.container") as SVGSVGElement);
        this.container?.append(this.parent);
        this.container?.setAttribute('viewBox', `0 0 100 1000`);
        console.log(this.container);

        // render SVG content
        this.render(true, true);

        // create grand piano synth
        const patch_url = new URL('/assets/sounds/voices/grand-piano/patch.json', import.meta.url);
        this.synth = new Synthesizer(patch_url);
    }

    disconnectedCallback() {
    }

    attributeChangedCallback(name : string, oldValue : string, newValue : string) {
    }

    update(major: boolean, note : boolean) {
        if (major) this.render(false, true);
        if (note) this.render(false, false);
    }

    // note event listeners
    /// play sound when note clicked
    playSound = (e : Event) => {
        const note = e.currentTarget as Element;
        let clickedIndex = Scale.NOTES.findIndex((value) => value === note.classList[1]) - Scale.startNote;
        if (clickedIndex < 0) clickedIndex += 7;

        if (Scale.isMajor) {
            if (note.classList.contains("last")) this.currNoteSound = Scale.MIDI[Scale.startNote] + Scale.MAJOR[clickedIndex] + 12;
            else this.currNoteSound = Scale.MIDI[Scale.startNote] + Scale.MAJOR[clickedIndex];
        }
        else {
            if (note.classList.contains("last")) this.currNoteSound = Scale.MIDI[Scale.startNote] + Scale.MINOR[clickedIndex] + 12;
            else this.currNoteSound = this.currNoteSound = Scale.MIDI[Scale.startNote] + Scale.MINOR[clickedIndex];
        }
        this.synth.playNote(this.currNoteSound);
    }

    stopSound = (e : Event) => {
        this.synth.releaseNote(this.currNoteSound);
    }

    /// add highlight when note hovered
    addHover = (e : Event) => {
        const note = e.currentTarget as Element;

        let allNotes;
        if (note.classList.contains("first")){
            allNotes = this.root.querySelectorAll(`.${note.classList[1]}.first, .wheel.${note.classList[1]}`);
        }
        else if (note.classList.contains("last")){
            allNotes = this.root.querySelectorAll(`.${note.classList[1]}.last, .wheel.${note.classList[1]}`);
        }
        else allNotes = this.root.querySelectorAll(`.${note.classList[1]}`);

        allNotes?.forEach((noteInstance) => {
            noteInstance.classList.add("hover");
        });
    };

    /// remove highlight when note unhovered
    removeHover = (e : Event) => {
        const note = e.currentTarget as Element;
        let allNotes = this.root.querySelectorAll(`.${note.classList[1]}`);
        allNotes?.forEach((noteInstance) => {
            noteInstance.classList.remove("hover");
        });
    }

    render(first : boolean, updateMaj : boolean) {
        if (this.container == null) return; // only render once mounted

        // remove old event listeners
        this.parent.removeEventListener('pointerdown', this.playSound);
        this.parent.removeEventListener('pointerup', this.stopSound);
        this.parent.removeEventListener('pointerleave', this.addHover);
        this.parent.removeEventListener('pointerenter', this.removeHover);

        // remove svg elements
        this.parent.innerHTML = "";
        Scale.ACCIDENTALS = ["", "", "", "", "", "", ""];

        // only render wheel and button if switching maj/min or first render
        if (updateMaj || first) {
            // generate wheel
            this.wheel = new NoteWheel(this);
            this.parent.append(this.wheel.el);

            // generate button
            this.button = new MajMinButton(this);
            this.parent.append(this.button.el);
        }
        else {
            // load existing wheel and button if exists
            if (this.wheel) this.parent.append(this.wheel.el);
            if (this.button) this.parent.append(this.button.el);
        }

        // generate staff
        const staff = new Staff(this);
        this.parent.append(staff.el);

        // generate code block
        const code = new CodeBlock(this);
        this.parent.append(code.el);

        // add event listeners
        const notes = this.root.querySelectorAll('.note');
        notes?.forEach((note) => {
            note.addEventListener('pointerdown', this.playSound);
            note.addEventListener('pointerup', this.stopSound);
            note.addEventListener('pointerenter', this.addHover);
            note.addEventListener('pointerleave', this.removeHover);
        });
    }
}

class MajMinButton {
    /// link back to the entire interactive to generate events
    scale : Scale;

    // x-coord of button
    get x() : number { return 2; }
    // y-coord of button
    get y() : number { return 2; }
    // height of button
    get height() : number { return 10; }
    // width of button
    get width() : number { return 26; }

    /// visual element for SVG
    el = document.createElementNS("http://www.w3.org/2000/svg", 'g');

    constructor(scale : Scale) {
        this.scale = scale;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
        rect.setAttribute("x", `${this.x}`);
        rect.setAttribute("y", `${this.y}`);
        rect.setAttribute("width", `${this.width}`);
        rect.setAttribute("height", `${this.height}`);
        rect.setAttribute("rx", "2");
        rect.setAttribute("ry", "2");
        rect.setAttribute("fill", "black");
        rect.setAttribute("fill-opacity", "0.3");
        rect.classList.add("button");
        this.el.append(rect);

        const t = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        t.classList.add("button-text");
        t.setAttribute("x", `${(this.x + this.width) - (this.width / 2)}`);
        t.setAttribute("y", `${(this.y + this.height) - (this.height / 2)}`);
        t.setAttribute("dominant-baseline", "central");
        t.innerHTML = Scale.isMajor ? "Major Scales" : "minor scales";
        this.el.append(t);

        // set up pointer events
        this.el.addEventListener('click', (e) => {
            Scale.isMajor = !Scale.isMajor;
            t.innerHTML = Scale.isMajor ? "Major Scales" : "minor scales";
            scale.update(true, false);
        });
    }
}

class NoteWheel {
    /// link back to the interactive to generate events
    scale : Scale;

    /// center x-coord of wheel
    get cx() : number { return 50; }
    /// center y-coord of wheel
    get cy() : number { return 39; }
    /// radius of wheel
    get r() : number { return 25; }
    /// num of sectors
    get numSectors() : number { return 7; }
    /// angle of each sector
    get angle() : number { return (360 / this.numSectors) * (Math.PI / 180); }
    /// offset angle
    get offset() : number { return 12.83 * (Math.PI / 180); }
    /// picker coords
    get pickerCoords() : number[][] { return [[50,18], [47,11], [53,11]]; }

    /// visual element for SVG
    el = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    /// wheel element
    wheel = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    /// wheel text
    text = document.createElementNS("http://www.w3.org/2000/svg", 'g');

    /// is pointer down?
    private down : boolean = false;

    constructor(scale : Scale){
        this.scale = scale;

        // note that starts on offset angle is note after starting note
        let currNote = Scale.startNote + 1;
        for (let i = 0; i < this.numSectors; i++) {
            let noteLetter = Scale.NOTES[(currNote + 7) % 7];
            const leftX = this.r * Math.cos(this.angle * (i + 1) + this.offset) + this.cx;
            const leftY = Math.abs(this.r * Math.sin(this.angle * (i + 1) + this.offset) - this.cy);
            const rightX = this.r * Math.cos(this.angle * i + this.offset) + this.cx;
            const rightY = Math.abs(this.r * Math.sin(this.angle * i + this.offset) - this.cy);

            const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
            path.setAttribute("d", `M ${this.cx} ${this.cy}
                L ${leftX} ${leftY}
                A ${this.r} ${this.r} 0 0 1 ${rightX} ${rightY}
                L ${this.cx} ${this.cy}`);
            path.classList.add("wheel", noteLetter, "note");
            this.wheel.append(path);

            const t = document.createElementNS("http://www.w3.org/2000/svg", 'text');

            t.setAttribute("x", `${(leftX + rightX + this.cx) / 3}`);
            t.setAttribute("y", `${((leftY + rightY + this.cy)) / 3}`);
            t.setAttribute("dominant-baseline", "central");
            t.innerHTML = `${noteLetter}`;

            if (Scale.isMajor) t.classList.add("major-text");
            else t.classList.add("minor-text");

            t.classList.add("wheel-text");
            this.text.append(t);

            currNote--;
        }
        this.wheel.append(this.text);
        this.el.append(this.wheel);

        // add picker
        const picker = document.createElementNS("http://www.w3.org/2000/svg", 'polygon');
        picker.setAttribute("points", `${this.pickerCoords}`);
        picker.setAttribute("fill", "grey");
        picker.setAttribute("fill-opacity", "0.8");
        this.el.append(picker);

        let totalAngle = 0;
        let lastAngle = 0;
        let startX = 0;
        let startY = 0;
        this.el.addEventListener('pointerdown', (e) => {
            this.down = true;
            startX = e.clientX;
            startY = e.clientY;
        });

        document.addEventListener('pointermove', (e) => {
            if(this.down){
                // rotate wheel
                const center = this.svgToScreen(this.cx, this.cy);
                const deltaX = e.clientX - center.x;
                const deltaY = e.clientY - center.y;
                totalAngle += (Math.atan2(deltaY, deltaX) - Math.atan2(startY - center.y, startX - center.x)) * 180 / Math.PI;

                this.wheel.setAttribute("transform", `rotate(${totalAngle} ${this.cx} ${this.cy})`);

                startX = e.x;
                startY = e.y;

                const letters = this.wheel.querySelectorAll('.wheel-text');
                letters?.forEach((letter) => {
                    letter.setAttribute("transform", `rotate(${-totalAngle}
                        ${letter.getAttribute("x")}
                        ${letter.getAttribute("y")})`);
                })
            }

            // determine current note selected by picker
            const testPoint = this.svgToScreen(50, 18);
            let sectors = this.scale.root.elementsFromPoint(testPoint.x, testPoint.y);
            sectors = sectors.filter((sector) => sector.classList.contains('wheel'));

            /// if picker touching sector, update selected note
            if (sectors.length > 0) {
                Scale.startNote = Scale.NOTES.indexOf(sectors[0].classList.item(1)!);
                scale.update(false, true);
            }
        });

        document.addEventListener('pointerup', (e) => {
            if (this.down)  this.down = false;

            // save current angle
            const center = this.svgToScreen(this.cx, this.cy);
            const deltaX = center.x - e.clientX;
            const deltaY = center.y - e.clientY;
            lastAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        });
    }

    // Transform svg coordinates to screen coordinates
    svgToScreen(svgX : number, svgY : number) {
        const svg = this.scale.container!;
        const p = svg.createSVGPoint();
        p.x = svgX;
        p.y = svgY;
        return p.matrixTransform(svg.getScreenCTM() ?? undefined);
    }
}

class Staff {
    /// link back to the entire interactive to generate events
    scale : Scale;

    /// y-coord of highest staff line
    get max() : number { return 70; }
    /// y-coord of lowest staff line
    get min() : number { return this.max + 3.25 * 4; }

    /// starting coords for first note
    get x0() : number { return 18; }
    get y0() : number { return 86; }

    /// visual element for SVG
    el = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    /// visual staff element for SVG
    staff = document.createElementNS("http://www.w3.org/2000/svg", 'g');

    constructor(scale : Scale){
        this.scale = scale;

        // create staff
        for (let i = 0; i < 5; i++) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", 'line');
            let y = this.max + 3.25 * i;
            line.setAttribute("x1", "0");
            line.setAttribute("y1", `${y}`);
            line.setAttribute("x2", "100");
            line.setAttribute("y2", `${y}`);
            line.classList.add("lines");
            this.staff.append(line);
        }

        // add treble clef
        const clef = document.createElementNS("http://www.w3.org/2000/svg", 'image');
        clef.setAttribute("href", "/assets/images/treble_clef.png");
        clef.setAttribute("x", "0");
        clef.setAttribute("y", "64");
        clef.setAttribute("width", "15");
        clef.setAttribute("height", "25");
        this.staff.append(clef);
        this.el.append(this.staff);

        // create scale
        /// y-coord range of staff and center of staff for stems/ledger lines
        let staffMin = this.min + 2;
        let staffMax = this.max - 2;
        let staffCenter = (staffMin + staffMax) / 2;

        let currNote = Scale.startNote;
        let noteLetter;
        for (let i = 0; i < 8; i++) {
            /// visual note element for SVG
            const note = document.createElementNS("http://www.w3.org/2000/svg", 'g');

            const ellipse = document.createElementNS("http://www.w3.org/2000/svg", 'ellipse');
            noteLetter = Scale.NOTES[(currNote + 7) % 7];

            // coords of note
            let x = this.x0 + 11 * (currNote - Scale.startNote);
            let y = this.y0 - 1.6 * currNote;

            ellipse.setAttribute("cx", `${x}`);
            ellipse.setAttribute("cy", `${y}`);
            ellipse.setAttribute("rx", "2");
            ellipse.setAttribute("ry", "1.2");
            ellipse.setAttribute("transform", `rotate(-18, ${x}, ${y})`);
            note.append(ellipse);

            const stem = document.createElementNS("http://www.w3.org/2000/svg", 'line');
            // line points up if note below staff center, down if above
            if (y > staffCenter) {
                stem.setAttribute("x1", `${x + 1.9}`);
                stem.setAttribute("y1", `${y - 0.8}`);
                stem.setAttribute("x2", `${x + 1.9}`);
                stem.setAttribute("y2", `${y - 9.5}`);
            }
            else {
                stem.setAttribute("x1", `${x - 1.9}`);
                stem.setAttribute("y1", `${y + 0.8}`);
                stem.setAttribute("x2", `${x - 1.9}`);
                stem.setAttribute("y2", `${y + 9.5}`);
            }
            note.append(stem);

            // add ledger line if note above/below staff
            if (y > staffMin || y < staffMax) note.append(this.drawLedger(x, y, staffMax, currNote));

            // add accidental if necessary
            const acc = this.addAccidental(noteLetter, note, x, y);
            if (acc) Scale.ACCIDENTALS[i] = acc;

            // add step marker unless on last note
            if (i != 7) this.el.append(this.drawSteps(i, x, y));

            note.classList.add("staff", noteLetter, "note");
            if(i == 0) note.classList.add("first");
            else if(i == 7) note.classList.add("last");
            this.el.append(note);

            currNote++;
        }
    }

    drawLedger(x : number, y : number, staffMax : number, currNote: number) {
        const ledger = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        ledger.setAttribute("x1", `${x - 3}`);
        ledger.setAttribute("x2", `${x + 2.7}`);

        // placement of ledger line depending if on or between lines
        if (currNote % 2 == 0){
            ledger.setAttribute("y1", `${y + 0.25}`);
            ledger.setAttribute("y2", `${y + 0.25}`);
        }
        else {
            // add line above/below note depending on if above/below staff
            if (y < staffMax) {
                ledger.setAttribute("y1", `${y + 1.25}`);
                ledger.setAttribute("y2", `${y + 1.25}`);
            }
            else {
                ledger.setAttribute("y1", `${y - 1.25}`);
                ledger.setAttribute("y2", `${y - 1.25}`);
            }
        }
        return ledger;
    }

    addAccidental(noteLetter: string, note : SVGGElement, x : number, y : number) {
        switch (noteLetter) {
            case "C":
                switch (Scale.startNote) {
                    case 1: // D Major
                    case 2: // E Major
                    case 5: // A Major
                        if (Scale.isMajor) {
                            note.append(this.drawSharp(x, y));
                            return "s";
                        }
                        break;
                    case 6: // B Major & minor
                        note.append(this.drawSharp(x, y));
                        return "s";
                }
                break;
            case "D":
                switch (Scale.startNote) {
                    case 2: // E Major
                    case 6: // B Major
                        if (Scale.isMajor) { 
                            note.append(this.drawSharp(x, y));
                            return "s";
                        }
                        break;
                    case 3: // f minor
                        if (!Scale.isMajor){ 
                            note.append(this.drawFlat(x, y));
                            return "f";
                        }
                }
                break;
            case "E":
                switch (Scale.startNote) {
                    case 0: // c minor
                    case 3: // f minor
                    case 4: // g minor
                        if (!Scale.isMajor){ 
                            note.append(this.drawFlat(x, y));
                            return "f";
                        }
                        break;
                }
                break;
            case "F":
                switch (Scale.startNote) {
                    case 1: // D Major
                    case 4: // G Major
                    case 5: // A Major
                        if (Scale.isMajor){ 
                            note.append(this.drawSharp(x, y));
                            return "s";
                        }
                        break;
                    case 2: // E Major & minor
                    case 6: // B Major & minor
                        note.append(this.drawSharp(x, y));
                        return "s";
                        break;
                }
                break;
            case "G":
                switch (Scale.startNote) {
                    case 2: // E Major
                    case 5: // A Major
                    case 6: // B Major
                        if (Scale.isMajor){ 
                            note.append(this.drawSharp(x, y));
                            return "s";
                        }
                        break;
                }
                break;
            case "A":
                switch (Scale.startNote) {
                    case 6: // B Major
                        if (Scale.isMajor){ 
                            note.append(this.drawSharp(x, y));
                            return "s";
                        }
                        break;
                    case 0: // c minor
                    case 3: // f minor
                        if (!Scale.isMajor){ 
                            note.append(this.drawFlat(x, y));
                            return "f";
                        }
                        break;
                }
                break;
            case "B":
                switch (Scale.startNote) {
                    case 0: // c minor
                    case 1: // d minor
                    case 4: // g minor
                        if (!Scale.isMajor){ 
                            note.append(this.drawFlat(x, y));
                            return "f";
                        }
                        break;
                    case 3: // F Major & minor
                        note.append(this.drawFlat(x, y));
                        return "f";
                }
                break;
        }
    }

    drawSharp(cx : number, cy : number) {
        const sharp = document.createElementNS("http://www.w3.org/2000/svg", 'g');

        const xLine1 = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        const xLine2 = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        const yLine1 = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        const yLine2 = document.createElementNS("http://www.w3.org/2000/svg", 'line');

        // top horizontal line
        xLine1.setAttribute("x1", `${cx - 5}`);
        xLine1.setAttribute("y1", `${cy + 1}`);
        xLine1.setAttribute("x2", `${cx - 3}`);
        xLine1.setAttribute("y2", `${cy - 1}`);
        sharp.append(xLine1);

        // bottom horizontal line
        xLine2.setAttribute("x1", `${cx - 5}`);
        xLine2.setAttribute("y1", `${cy + 3}`);
        xLine2.setAttribute("x2", `${cx - 3}`);
        xLine2.setAttribute("y2", `${cy + 1}`);
        sharp.append(xLine2);

        // left vertical line
        yLine1.setAttribute("x1", `${cx - 4.35}`);
        yLine1.setAttribute("y1", `${cy + 4.5}`);
        yLine1.setAttribute("x2", `${cx - 4.35}`);
        yLine1.setAttribute("y2", `${cy - 1.5}`);
        sharp.append(yLine1);

        // right vertical line
        yLine2.setAttribute("x1", `${cx - 3.55}`);
        yLine2.setAttribute("y1", `${cy + 3.5}`);
        yLine2.setAttribute("x2", `${cx - 3.55}`);
        yLine2.setAttribute("y2", `${cy - 2.5}`);
        sharp.append(yLine2);

        return sharp;
    }

    drawFlat(cx : number, cy : number) {
        const flat = document.createElementNS("http://www.w3.org/2000/svg", 'g');

        const line = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        const curve = document.createElementNS("http://www.w3.org/2000/svg", 'path');

        line.setAttribute("x1", `${cx - 4.35}`);
        line.setAttribute("y1", `${cy + 1.5}`);
        line.setAttribute("x2", `${cx - 4.35}`);
        line.setAttribute("y2", `${cy - 4.5}`);
        flat.append(line);

        curve.setAttribute("d", `M ${cx - 4.35} ${cy} A 2.5 0.5 -45 0 1 ${cx - 4.35} ${cy + 1.5}`);
        curve.setAttribute("fill", "none");
        flat.append(curve);

        return flat;
    }

    drawSteps(i : number, x : number, y : number) {
        const step = document.createElementNS("http://www.w3.org/2000/svg", 'polyline');
        // if major, half steps on 3rd and 6th notes
        if (Scale.isMajor) {
            if (i == 2 || i == 6) step.classList.add("half");
            else step.classList.add("whole");
        }
        // if minor, half steps on 2nd and 5th notes
        else {
            if (i == 1 || i == 4) step.classList.add("half");
            else step.classList.add("whole");
        }
        step.setAttribute("points", `${x + 0.6} ${y + 2.2},
            ${x + 5.5} ${y + 6},
            ${x + 5.5} ${y + 6},
            ${x + 10.4} ${y + 0.6}`);
        return step;
    }
}

class CodeBlock {
    /// link back to the entire interactive to generate events
    scale : Scale;

    // x-coord of block
    get x() : number { return 26.5; }
    // y-coord of block
    get y() : number { return 96; }
    // height of block
    get height() : number { return 45; }
    // width of block
    get width() : number { return 47.5; }

    /// visual element for SVG
    el = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    /// main rectangle
    rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

    constructor(scale : Scale) {
        this.scale = scale;

        this.rect.setAttribute("x", `${this.x}`);
        this.rect.setAttribute("y", `${this.y}`);
        this.rect.setAttribute("width", `${this.width}`);
        this.rect.setAttribute("height", `${this.height}`);
        this.rect.setAttribute("rx", "2");
        this.rect.setAttribute("ry", "2");
        this.rect.setAttribute("fill", "black");
        this.rect.setAttribute("fill-opacity", "0.7");
        this.el.append(this.rect);

        let noteNum = Scale.MIDI[Scale.startNote];
        for (let i = 0; i < 8; i++){
            const t = document.createElementNS("http://www.w3.org/2000/svg", 'text');
            t.setAttribute("x", `${(this.x + this.width) - (this.width / 2) - 4.5}`);
            t.setAttribute("y", `${this.y + 5 + i * 5}`);
            t.setAttribute("dominant-baseline", "central");

            const comment = document.createElementNS("http://www.w3.org/2000/svg", 'text');
            comment.setAttribute("x", `${(this.x + this.width) - (this.width / 2) + 12.5}`);
            comment.setAttribute("y", `${this.y + 6.3 + i * 5}`);

            if (Scale.ACCIDENTALS[i] == "s") comment.innerHTML = `# ${Scale.NOTES[(Scale.startNote + i + 7) % 7]}&#x266F`
            else if (Scale.ACCIDENTALS[i] == "f") comment.innerHTML = `# ${Scale.NOTES[(Scale.startNote + i + 7) % 7]}&#9837`
            else comment.innerHTML = `# ${Scale.NOTES[(Scale.startNote + i + 7) % 7]}`;
            comment.classList.add("comment");
            this.el.append(comment);

            // add MIDI number
            if (Scale.isMajor) t.innerHTML = `playSound(${noteNum + Scale.MAJOR[i]})`;
            else t.innerHTML = `playSound(${noteNum + Scale.MINOR[i]})`;

            t.classList.add("code", Scale.NOTES[(Scale.startNote + i + 7) % 7], "note");
            if(i == 0) t.classList.add("first");
            else if(i == 7) t.classList.add("last");
            this.el.append(t);
        }
    }
}

