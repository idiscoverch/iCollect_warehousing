import { Component, OnInit } from '@angular/core';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { NetworkService, ConnectionStatus } from '../services/network.service';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { DatabaseService } from '../services/database.service';
import { LoadingService } from '../services/loading.service';
import { TranslateService } from '@ngx-translate/core';
import { File } from '@ionic-native/file/ngx';
import { HTTP } from '@ionic-native/http/ngx';


@Component({
  selector: 'app-sync',
  templateUrl: './sync.page.html',
  styleUrls: ['./sync.page.scss'],
})
export class SyncPage implements OnInit {

  network = false;

  progress: any;
  data: any[] = [];

  constructor(
    public http: HTTP,
    private db: DatabaseService,
    private alertCtrl: AlertController,
    private toastController: ToastController,
    public translate: TranslateService,
    private backgroundMode: BackgroundMode,
    private networkService: NetworkService,
    private loading: LoadingService,
    private transfer: FileTransfer,
    public navCtrl: NavController,
    private file: File
  ) { }

  ngOnInit() {
    this.networkService.onNetworkChange().subscribe((status: ConnectionStatus) => {
      if (status == ConnectionStatus.Online) {
        this.network = true;
      } else { this.network = false; }
    });

    this.db.loadPurchasePicturesSync().then(_ => {
      this.db.getPurchasePictures().subscribe(data => {
        this.data = [];
        this.data = data;
      });
    });
  }

  /*resync() {
    this.db.tickerAsNotSync().then(()=> {
      this.presentAlert('You can now sync all data again', 'Succes');
    });
  }*/

  sync() {
    if (this.network == true) {
      this.backgroundMode.enable();
      this.translate.get('UPLOAD_BACKGROUND').subscribe(value => {
        this.presentAlert(value, 'Info');
      });

      this.data.forEach(value => { 
        let filepath = this.file.externalDataDirectory + 'warehouse_photos/';
        let filename = value.filename;
        let id_doc = value.id_doc;
        let wh_purchase_transaction_id = value.wh_purchase_transaction_id;
        let doc_type = value.doc_type;
        let description = value.description;
        let coordx = value.coordx;
        let coordy = value.coordy;
        let accuracy = value.accuracy;
        let heading = value.heading;
        let agent_id = value.agent_id;
        let doc_date = value.doc_date;
        let cloud_path = value.cloud_path; 
        let id_palette = value.id_palette;

        if (cloud_path != null) { 
          this.save(id_doc, agent_id, doc_type, cloud_path, doc_date, coordx, coordy, accuracy, heading, wh_purchase_transaction_id, description, id_palette);

        } else {
          let documentsURL = encodeURI(filepath + filename);

          var url = encodeURI("https://api.cloudinary.com/v1_1/www-idiscover-live/image/upload");
      
          let options: FileUploadOptions = {
            fileKey: "file",
            fileName: filename,
            chunkedMode: false,
            mimeType: "multipart/form-data",
            params: { 'upload_preset': 'qlwg19jv' }
          }
       
          const fileTransfer: FileTransferObject = this.transfer.create();
         
          fileTransfer.upload(documentsURL, url, options, true)
            .then((data) => { 
              console.log(data);
           
              let r = data.response.trim();
              let cUrl = JSON.parse(r);
              let file_url = JSON.stringify(cUrl.secure_url).split('"').join('');
             
              var m = new Date();
              let timestamp = m.getUTCFullYear() + "/" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "/" + ("0" + m.getUTCDate()).slice(-2) + " " + ("0" + m.getUTCHours()).slice(-2) + ":" + ("0" + m.getUTCMinutes()).slice(-2) + ":" + ("0" + m.getUTCSeconds()).slice(-2);
              this.db.addData('warehouse_picture', timestamp, null, 1, null);
             
              this.db.updateCloudLinkPurchaseDoc(file_url, id_doc).then(() => {
                this.save(id_doc, agent_id, doc_type, file_url, doc_date, coordx, coordy, accuracy, heading, wh_purchase_transaction_id, description, id_palette);
              });

              this.translate.get('CONTACT_DOC_UPLOAD_SUCCESS').subscribe(
                value => { this.toastAlert(value); }
              );

            }, (err) => { 
              console.log(err);
              this.translate.get('CONTACT_DOC_UPLOAD_ERROR').subscribe(
                value => { this.toastAlert(value); }
              );
            });
        }
      });

    } else {
      this.translate.get('CHECK_INTERNET').subscribe(value => {
        this.toastAlert(value);
      });
    }
  }

  save(id_doc, agent_id, doc_type, doc_link, doc_date, coordx, coordy, accuracy, heading, transaction_id, description, id_palette) {
    if (this.network == true) {  
      var link = 'http://33886.hostserv.eu:9090/ords/icoop/wh/doc/';
      var myData = JSON.stringify({
        CONTACT_ID: agent_id,
        DOC_TYPE: doc_type,
        DOC_LINK: doc_link,
        DOC_DATE: doc_date,
        SYNC: 1,
        COORDX: coordx,
        COORDY: coordy,
        ACCURACY: accuracy,
        HEADING: heading,
        AGENT_ID: agent_id,
        ID_HOUSEHOLD: null,
        MEDIA_TYPE: 154,
        WH_PURCHASE_TRANSATION_ID: transaction_id,
        WAREHOUSE_ID: null,
        DESCRIPTION: description,
        LEGEND: null,
        ID_PALETTE: id_palette
      });

      this.http.setDataSerializer('utf8');
      this.http.post(link, myData, {})
        .then(() => { 
          this.db.updateSyncDoc(1, id_doc);
          this.toastAlert('Données chargés avec succès.');

        }).catch((error) => { 
          this.presentAlert('Echec du trasfert au serveur', 'Erreur');

          console.error('API Error : ', error.status);
          console.error('API Error : ', JSON.stringify(error));
        });

    } else {
      this.toastAlert('Vérifier votre connexion à internet');
    }
  } 

  del(id_doc) {
    this.db.deletePurchaseDoc(id_doc).then(() => {
      this.toastAlert('Supprimé avec succès.');
    });
  }

  async presentAlert(message, title) {
    const alert = await this.alertCtrl.create({
      message: message,
      subHeader: title,
      buttons: ['OK']
    });
    alert.present();
  }

  async toastAlert(message) {
    let toast = this.toastController.create({
      message: message,
      duration: 1500,
      position: 'bottom'
    });
    toast.then(toast => toast.present());
  }

  back() {
    this.navCtrl.navigateBack(['/tabs/settings']);
  }
}
