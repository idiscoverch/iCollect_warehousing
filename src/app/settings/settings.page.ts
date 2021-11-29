import { Component, OnInit } from '@angular/core';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../services/database.service';
import { LoadingService } from '../services/loading.service';
import { NetworkService, ConnectionStatus } from '../services/network.service';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { File } from '@ionic-native/file/ngx';
import { Insomnia } from '@ionic-native/insomnia/ngx';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  lang: any;
  user: any;
  backup_data_date: string; 
  backup_data = false;

  constructor(
    private file: File,
    public translate: TranslateService,
    private networkService: NetworkService,
    private toastController: ToastController,
    private alertCtrl: AlertController,
    private loading: LoadingService,
    private transfer: FileTransfer,
    public navCtrl: NavController,
    private insomnia: Insomnia,
    private db: DatabaseService
  ) { }

  ngOnInit() {
    this.db.lastBackupData().then(data => {
      this.backup_data_date = data.data_date;
      this.backup_data = true;
    });

    this.db.lastLogedUser().then(usr => {
      this.user = usr;
      this.lang = usr.lang;
    });
  }

  uploadPurchaseDocs() {
    this.navCtrl.navigateForward(['/sync']);
  }

  backup() {
    this.networkService.onNetworkChange().subscribe((status: ConnectionStatus) => {
      if (status == ConnectionStatus.Online) {
        this.translate.get('UPLOADING_DB').subscribe(value => {
          this.loading.showLoader(value);
        });

        this.file.checkFile(this.file.applicationStorageDirectory + 'databases/', 'icollect_warehouse_0.0.1.db').then((files) => {
          let dbURL = encodeURI(this.file.applicationStorageDirectory + 'databases/icollect_warehouse_0.0.1.db');

          let m = new Date();
          let timestamp = m.getUTCFullYear() + "-" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + m.getUTCDate()).slice(-2) + "_" + ("0" + m.getUTCHours()).slice(-2) + "." + ("0" + m.getUTCMinutes()).slice(-2) + "." + ("0" + m.getUTCSeconds()).slice(-2);
          let filename = 'WH-' + this.user.id_contact +'-'+ timestamp + ".db";

          let url = encodeURI("https://icoop.live/ic/mobile_upload.php?func=database");

          let options: FileUploadOptions = {
            fileKey: "file",
            fileName: filename,
            chunkedMode: false,
            mimeType: "multipart/form-data",
            params: { 'fileName': filename, 'func': 'database' }
          }

          const fileTransfer: FileTransferObject = this.transfer.create();

          fileTransfer.upload(dbURL, url, options, true)
            .then((data) => {
              console.log(data);

              this.translate.get('BACKUP_DB_SUCCESS').subscribe(
                value => { this.presentAlert(value, 'Success'); }
              );

              var m = new Date();
              let timestamp = m.getUTCFullYear() + "/" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "/" + ("0" + m.getUTCDate()).slice(-2) + " " + ("0" + m.getUTCHours()).slice(-2) + ":" + ("0" + m.getUTCMinutes()).slice(-2) + ":" + ("0" + m.getUTCSeconds()).slice(-2);
              this.db.addData('backup', timestamp, null, 1, null);

              this.loading.hideLoader();

            }, (err) => {
              console.log(err);
              this.loading.hideLoader();

              this.translate.get('BACKUP_DB_ERROR').subscribe(
                value => { this.presentAlert(value, 'Error'); }
              );
            });

        }).catch((err) => {
          console.log(err);
          this.loading.hideLoader();
        });
      }

      if (status == ConnectionStatus.Offline) {
        this.translate.get('CHECK_INTERNET').subscribe(value => {
          this.toastAlert(value);
        });
      }
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
      duration: 3000,
      position: 'bottom'
    });
    toast.then(toast => toast.present());
  }

  changeLanguage(lang: any) {
    this.translate.use(lang);
  }

  restFetchRegvalues() {
    this.navCtrl.navigateForward(['/download-list', 'regvalues']);
  }

  logout() {
    this.db.logOut(this.user.id_contact).then(_ => {
      let data = {
        lang: this.user.lang,
        username: this.user.username,
        password: atob(this.user.pass_value)
      };

      this.navCtrl.navigateRoot(['login', data]);
    });

    this.insomnia.allowSleepAgain()
      .then(
        () => console.log('success'),
        () => console.log('error')
      );
  }

}
