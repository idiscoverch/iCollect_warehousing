import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { SignaturePad } from 'angular2-signaturepad';
import { File } from '@ionic-native/file/ngx';
import { HTTP } from '@ionic-native/http/ngx';
import { DatabaseService } from '../services/database.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-signature',
  templateUrl: './signature.page.html',
  styleUrls: ['./signature.page.scss'],
})
export class SignaturePage implements OnInit {

  signature = '';
  isDrawing = false;

  id_contact: any;
  id_supplier: any;
  warehouse_id: any;
  transaction_id: any;
  palette_id: any;
  palette_code: any;
  type: any;
  signed = false;

  @ViewChild(SignaturePad, { static: false }) signaturePad: SignaturePad;

  public signaturePadOptions: Object = {
    'minWidth': 2,
    'canvasWidth': 400,
    'canvasHeight': 200,
    'backgroundColor': '#f6fbff',
    'penColor': '#666a73'
  };

  constructor(
    private db: DatabaseService,
    public translate: TranslateService,
    private toastController: ToastController,
    private activatedRoute: ActivatedRoute,
    public navCtrl: NavController,
    private http: HTTP,
    private file: File
  ) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe(param => {
      this.warehouse_id = param.get('warehouse_id');
      this.transaction_id = param.get('transaction_id');
      this.palette_id = param.get('palette_id');
      this.palette_code = param.get('palette_code');
      this.type = param.get('type');
    });

    this.db.createDocumentsDir();

    this.http.get('http://33886.hostserv.eu:9090/ords/icoop/wh/purchaseorder/?q=%7b%22wh_purchase_transaction_id%22:%22' + this.transaction_id + '%22%7d', {}, {}).then(data => {
      let rows = JSON.parse(data.data);
      this.id_supplier = rows.items[0].id_supplier;
    });

    if(this.signature){ this.signaturePad.clear(); }
  }

  savePad() {
    this.signature = this.signaturePad.toDataURL("image/jpeg");

    var m = new Date();
    let created_date = m.getUTCFullYear() + "-" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + m.getUTCDate()).slice(-2) + "_" + ("0" + m.getUTCHours()).slice(-2) + "-" + ("0" + m.getUTCMinutes()).slice(-2) + "-" + ("0" + m.getUTCSeconds()).slice(-2);

    let realData = this.signature.split(",")[1];
    let blob = this.b64toBlob(realData, 'image/jpeg');
    let filepath = this.file.externalDataDirectory + 'documents/';

    this.db.lastLogedUser().then(usr => { 
      this.id_contact = usr.id_contact;

      if(this.type == 'weighbridge_agent'){
        var newFileName = this.id_contact+'_920_'+created_date + ".jpg"; 
        this.file.writeFile(filepath, newFileName, blob).then(() =>{
          this.db.saveDocData(this.id_contact, this.transaction_id, newFileName, 'Weighbridge 1 Agent signature', 920, null);
        });
      } else
      if(this.type == 'manager') {
        var newFileName = this.id_contact+'_891_'+created_date + ".jpg";
        this.file.writeFile(filepath, newFileName, blob).then(() =>{
          this.db.saveDocData(this.id_contact, this.transaction_id, newFileName, 'Unloading Manager signature', 891, null);
          this.signed = true;
        });
      } else
      if(this.type == 'supplier') {
        var newFileName = this.id_contact+'_892_'+created_date + ".jpg";
        this.file.writeFile(filepath, newFileName, blob).then(() =>{
          this.db.saveDocData(this.id_contact, this.transaction_id, newFileName, 'Unloading Supplier signature', 892, null);
          this.signed = true;
        });
      } else
      if(this.type == 'weighbridge_agent2') {
        var newFileName = this.id_contact+'_920_'+created_date + ".jpg";
        this.file.writeFile(filepath, newFileName, blob).then(() =>{
          this.db.saveDocData(this.id_contact, this.transaction_id, newFileName, 'Weighbridge 2 Agent signature', 920, null);
        });
      } else {
        var newFileName = this.id_contact+'_921_'+created_date + ".jpg";
        this.file.writeFile(filepath, newFileName, blob).then(() =>{
          this.db.saveDocData(this.id_contact, this.transaction_id, newFileName, 'Agent CCC signature', 921, null);
        });
      }

    });

    this.signaturePad.clear();

    this.translate.get('SIGNATURE_SAVE_SUCCESS').subscribe(value => {
      this.toastAlert(value);
    });

    this.back();
  }

  drawComplete() {
    this.isDrawing = false;
  }

  drawStart() {
    this.isDrawing = true;
  }

  b64toBlob(b64Data, contentType) {
    contentType = contentType || '';
    var sliceSize = 512;
    var byteCharacters = atob(b64Data);
    var byteArrays = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var slice = byteCharacters.slice(offset, offset + sliceSize);

      var byteNumbers = new Array(slice.length);
      for (var i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, { type: contentType });
    return blob;
  }

  clearPad() { 
    this.signaturePad.clear();
  }

  back() {
    let data = {
      transaction_id: this.transaction_id,
      warehouse_id: this.warehouse_id,
      palette_code: this.palette_code,
      palette_id: this.palette_id,
      id_supplier: this.id_supplier,
      signed: this.signed
    }

    if (this.type == 'weighbridge_agent') {
      this.navCtrl.navigateBack(['/weight', data]);
    } else
      if ((this.type == 'weighbridge_agent2') || (this.type == 'agent_ccc')) {
        this.navCtrl.navigateBack(['/weight2', data]);
      } else {
        this.navCtrl.navigateBack(['/unloading', data]);
      }

  }

  async toastAlert(message) {
    let toast = this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom'
    });
    toast.then(toast => toast.present());
  }

}
