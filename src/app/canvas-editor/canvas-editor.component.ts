import { CommonModule } from '@angular/common';
import {
    Component,
    ElementRef,
    HostListener,
    OnInit,
    ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface CanvasObject {
    type: 'image' | 'text';
    image?: HTMLImageElement;
    text?: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    rotation: number;
    fontSize?: number;
    fontFamily?: string;
    initialRotation?: number;
    color?: string;
    selected: boolean;
    isEditing?: boolean;
}

@Component({
    selector: 'app-canvas-editor',
    imports: [FormsModule, CommonModule],
    templateUrl: './canvas-editor.component.html',
    styleUrl: './canvas-editor.component.css'
})


export class CanvasEditorComponent implements OnInit {
    @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('textInput', { static: false }) textInputRef!: ElementRef<HTMLTextAreaElement>;

    ctx!: CanvasRenderingContext2D;
    objects: CanvasObject[] = [];
    selectedIndex = -1;
    isDragging = false;
    isResizing = false;
    isRotating = false;
    lastPos = { x: 0, y: 0 };
    resizeHandle = '';
    handleRadius = 8;
    initialAngle = 0;

    ngOnInit() {
        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.draw();
    }

    onImageUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files![0];
        if (!file) {
            return
        };
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => this.addImageObject(img);
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    }

    addImageObject(img: HTMLImageElement) {
        const canvas = this.canvasRef.nativeElement;
        const maxW = canvas.width * 0.8, maxH = canvas.height * 0.8;
        let w = img.width, h = img.height;
        if (w > maxW) { h *= maxW / w; w = maxW; }
        if (h > maxH) { w *= maxH / h; h = maxH; }

        this.objects.forEach(o => o.selected = false);
        this.objects.push({
            type: 'image',
            image: img,
            position: { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2 },
            size: { width: w, height: h },
            rotation: 0,
            selected: true
        });
        this.selectedIndex = this.objects.length - 1;
        this.draw();
    }

    addText() {
        const canvas = this.canvasRef.nativeElement;
        this.objects.forEach(o => o.selected = false);
        this.objects.push({
            type: 'text',
            text: 'New text',
            fontSize: 24,
            fontFamily: 'Arial',
            color: '#000',
            position: { x: canvas.width / 2, y: canvas.height / 2 },
            size: { width: 200, height: 50 },
            rotation: 0,
            selected: true
        });
        this.selectedIndex = this.objects.length - 1;
        this.draw();
    }

    clearCanvas() {
        this.objects = [];
        this.selectedIndex = -1;
        this.draw();
    }

    @HostListener('mousedown', ['$event'])
    onMouseDown(e: MouseEvent) {
        const canvas = this.canvasRef.nativeElement;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.lastPos = { x: mouseX, y: mouseY };

        if (this.selectedIndex >= 0) {
            const obj = this.objects[this.selectedIndex];
            const handle = this.getResizeHandle(mouseX, mouseY, obj);
            if (handle) {
                if (handle === 'rotate') {
                    this.isRotating = true;
                    obj.initialRotation = obj.rotation;

                    const centerX = obj.position.x + obj.size.width / 2;
                    const centerY = obj.position.y + obj.size.height / 2;
                    this.initialAngle = Math.atan2(mouseY - centerY, mouseX - centerX);

                } else {
                    this.isResizing = true;
                    this.resizeHandle = handle;

                }
                this.disableTextEditing();
                return;
            }
        }

        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.isInObject(mouseX, mouseY, this.objects[i])) {
                const obj = this.objects[i];
                this.objects.forEach(o => o.selected = false);
                obj.selected = true;
                this.selectedIndex = i;

                if (obj.type === 'text') {
                    console.log('Text object clicked:', obj);
                    this.enableTextEditing(obj);
                }

                this.isDragging = true;
                this.draw();
                return;
            }
        }

        this.objects.forEach(obj => (obj.selected = false));
        this.selectedIndex = -1;
        this.disableTextEditing();
        this.draw();
    }

    @HostListener('mousemove', ['$event'])
    onMouseMove(e: MouseEvent) {
        const canvas = this.canvasRef.nativeElement;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        canvas.style.cursor = 'default';

        if (this.isDragging) {
            canvas.style.cursor = 'move';
            const dx = mouseX - this.lastPos.x;
            const dy = mouseY - this.lastPos.y;

            if (this.selectedIndex > -1) {
                const obj = this.objects[this.selectedIndex];

                obj.position.x += dx;
                obj.position.y += dy;
            }

            this.lastPos = { x: mouseX, y: mouseY };
            this.draw();
            return;
        }

        if (this.isResizing && this.selectedIndex > -1) {
            const obj = this.objects[this.selectedIndex];

            const dx = mouseX - this.lastPos.x;
            const dy = mouseY - this.lastPos.y;

            // Convert global delta to object-local coordinates
            const cos = Math.cos(-obj.rotation);
            const sin = Math.sin(-obj.rotation);
            const localDx = dx * cos - dy * sin;
            const localDy = dx * sin + dy * cos;

           
            switch (this.resizeHandle) {
                case 'right':
                    obj.size.width += localDx;
                    obj.size.height = obj.size.width;
                    break;
                case 'left':
                    obj.position.x += localDx * Math.cos(obj.rotation);
                    obj.position.y += localDx * Math.sin(obj.rotation);
                    obj.size.width -= localDx;
                    obj.size.height = obj.size.width;
                    break;
                case 'top':
                    obj.position.x += localDy * Math.sin(obj.rotation);
                    obj.position.y -= localDy * Math.cos(obj.rotation);
                    obj.size.height -= localDy;
                    obj.size.width = obj.size.height;
                    break;
                case 'bottom':
                    obj.size.height += localDy;
                    obj.size.width = obj.size.height;
                    break;
                case 'top-left':
                    obj.position.x += localDx * Math.cos(obj.rotation) + localDy * Math.sin(obj.rotation);
                    obj.position.y += localDy * Math.cos(obj.rotation) - localDx * Math.sin(obj.rotation);
                    obj.size.width -= localDx;
                    obj.size.height = obj.size.width;
                    break;
                case 'bottom-right':
                    obj.size.width += localDx;
                    obj.size.height = obj.size.width;
                    break;
                case 'top-right':
                    obj.position.y += localDy * Math.cos(obj.rotation) - localDx * Math.sin(obj.rotation);
                    obj.size.width += localDx;
                    obj.size.height = obj.size.width;
                    break;
                case 'bottom-left':
                    obj.position.x += localDx * Math.cos(obj.rotation);
                    obj.position.y += localDx * Math.sin(obj.rotation);
                    obj.size.width -= localDx;
                    obj.size.height = obj.size.width;
                    break;
            }

            this.lastPos = { x: mouseX, y: mouseY };
            this.draw();
        }

        if (this.isRotating && this.selectedIndex > -1) {
            canvas.style.cursor = 'crosshair';
            const obj = this.objects[this.selectedIndex];
            const centerX = obj.position.x + obj.size.width / 2;
            const centerY = obj.position.y + obj.size.height / 2;

            const currentAngle = Math.atan2(mouseY - centerY, mouseX - centerX);

            const angleDiff = currentAngle - this.initialAngle;

            obj.rotation = obj.initialRotation! + angleDiff;


            this.lastPos = { x: mouseX, y: mouseY };
            this.draw();
            return;
        }

        if (this.selectedIndex > -1) {
            const obj = this.objects[this.selectedIndex];
            const handle = this.getResizeHandle(mouseX, mouseY, obj);

            if (handle) {
                switch (handle) {
                    case 'rotate':
                        canvas.style.cursor = 'crosshair';
                        break;
                    case 'left':
                    case 'right':
                        canvas.style.cursor = 'ew-resize';
                        break;
                    case 'top':
                    case 'bottom':
                        canvas.style.cursor = 'ns-resize';
                        break;
                    case 'top-left':
                    case 'bottom-right':
                        canvas.style.cursor = 'nwse-resize';
                        break;
                    case 'top-right':
                    case 'bottom-left':
                        canvas.style.cursor = 'nesw-resize';
                        break;
                }
                return;
            }

            // Check if hovering over the object
            if (this.isInObject(mouseX, mouseY, obj)) {
                canvas.style.cursor = 'move';
                return;
            }
        }
    }

    @HostListener('mouseup')
    onMouseUp() { this.isDragging = this.isResizing = this.isRotating = false; }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (this.selectedIndex > -1) {
                this.objects.splice(this.selectedIndex, 1);
                this.selectedIndex = -1;
                this.draw();
            }
        }
    }

    enableTextEditing(obj: CanvasObject) {
        const canvas = this.canvasRef.nativeElement;
        const textarea = this.textInputRef.nativeElement;
        obj.isEditing = true;

        textarea.style.position = 'absolute';
        textarea.style.left = `${canvas.offsetLeft + obj.position.x}px`;
        textarea.style.top = `${canvas.offsetTop + obj.position.y}px`;
        textarea.style.width = `${obj.size.width}px`;
        textarea.style.height = `${obj.size.height}px`;
        textarea.style.fontSize = `${obj.fontSize}px`;
        textarea.style.fontFamily = obj.fontFamily!;
        textarea.style.color = obj.color!;
        textarea.style.border = 'none';
        textarea.style.resize = 'none';
        textarea.style.background = 'transparent';
        textarea.style.padding = '0';
        textarea.style.margin = '0';
        textarea.style.overflow = 'hidden';
        textarea.style.display = 'block';
        textarea.value = obj.text!;

        textarea.focus();

        textarea.oninput = () => {
            obj.text = textarea.value;
            this.draw();
        };

        textarea.onblur = () => {
            obj.isEditing = false;
            this.draw();
        };
    }

    disableTextEditing() {
        const textarea = this.textInputRef.nativeElement;
        textarea.style.display = 'none';
        textarea.oninput = null;
    }

    isInResizeHandle(x: number, y: number, obj: CanvasObject): boolean {
        const handleX = obj.position.x + obj.size.width;
        const handleY = obj.position.y + obj.size.height;
        const dx = x - handleX;
        const dy = y - handleY;
        return Math.sqrt(dx * dx + dy * dy) <= this.handleRadius;
    }

    isInObject(x: number, y: number, obj: CanvasObject): boolean {
        const centerX = obj.position.x + obj.size.width / 2;
        const centerY = obj.position.y + obj.size.height / 2;

        const dx = x - centerX;
        const dy = y - centerY;

        const cos = Math.cos(-obj.rotation);
        const sin = Math.sin(-obj.rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Check if the point is within the object's bounds
        return (
            localX >= -obj.size.width / 2 &&
            localX <= obj.size.width / 2 &&
            localY >= -obj.size.height / 2 &&
            localY <= obj.size.height / 2
        );
    }

    getResizeHandle(x: number, y: number, obj: CanvasObject): string | null {

        const objCenterX = obj.position.x + obj.size.width / 2;
        const objCenterY = obj.position.y + obj.size.height / 2;

        let translateX = x - objCenterX;
        let translateY = y - objCenterY;

        // rotate
        const rotation = -obj.rotation;
        const rotatedX = translateX * Math.cos(rotation) - translateY * Math.sin(rotation);
        const rotatedY = translateX * Math.sin(rotation) + translateY * Math.cos(rotation);

        // translate back
        translateX = rotatedX + objCenterX;
        translateY = rotatedY + objCenterY;

        // Check the handles
        const handles = {
            'rotate': { x: obj.position.x + obj.size.width / 2, y: obj.position.y - 30 },
            'left': { x: obj.position.x, y: obj.position.y + obj.size.height / 2 },
            'right': { x: obj.position.x + obj.size.width, y: obj.position.y + obj.size.height / 2 },
            'top': { x: obj.position.x + obj.size.width / 2, y: obj.position.y },
            'bottom': { x: obj.position.x + obj.size.width / 2, y: obj.position.y + obj.size.height },
            'top-left': { x: obj.position.x, y: obj.position.y },
            'top-right': { x: obj.position.x + obj.size.width, y: obj.position.y },
            'bottom-left': { x: obj.position.x, y: obj.position.y + obj.size.height },
            'bottom-right': { x: obj.position.x + obj.size.width, y: obj.position.y + obj.size.height },
        };

        for (const [handle, pos] of Object.entries(handles)) {
            const dx = translateX - pos.x;
            const dy = translateY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.handleRadius) {
                return handle;
            }
        }

        return null;
    }

    drawResizeHandles(obj: CanvasObject) {
        const handlePositions = [
            { x: obj.size.width / 2, y: -30 }, // Rotation handle 
            { x: 0, y: obj.size.height / 2 }, // Left-middle
            { x: obj.size.width, y: obj.size.height / 2 }, // Right-middle
            { x: obj.size.width / 2, y: obj.size.height }, // Bottom-middle
            { x: obj.size.width / 2, y: 0 }, // Top-middle
            { x: 0, y: 0 }, // Top-left
            { x: obj.size.width, y: 0 }, // Top-right
            { x: 0, y: obj.size.height }, // Bottom-left
            { x: obj.size.width, y: obj.size.height }, // Bottom-right
        ];

        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#0095ff';
        this.ctx.lineWidth = 2;
        handlePositions.forEach((pos) => {
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.handleRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    draw() {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);


        this.objects.forEach((obj, index) => {
            this.ctx.save();
            const cx = obj.position.x + obj.size.width / 2;
            const cy = obj.position.y + obj.size.height / 2;

            this.ctx.translate(obj.position.x + obj.size.width / 2, obj.position.y + obj.size.height / 2);
            this.ctx.rotate(obj.rotation); // rotation in radians
            this.ctx.translate(-obj.size.width / 2, -obj.size.height / 2);

            if (obj.type === 'image') {
                this.ctx.drawImage(obj.image!, 0, 0, obj.size.width, obj.size.height);
            } else if (obj.type === 'text' && !obj.isEditing) {
                // render text if its not being edited
                this.ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
                this.ctx.fillStyle = obj.color!;
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(obj.text!, 0, 0);
            }

            if (obj.selected) {
                this.ctx.strokeStyle = '#0095ff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(-2, -2, obj.size.width + 4, obj.size.height + 4);

                this.drawResizeHandles(obj);
            }

            this.ctx.restore();
        });
    }
}