import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CanvasEditorComponent } from "./canvas-editor/canvas-editor.component";
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CanvasEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'angular-tech-exam';
}
