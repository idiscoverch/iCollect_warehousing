import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { SQLitePorter } from '@ionic-native/sqlite-porter/ngx';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite/ngx';
import { TranslateService } from '@ngx-translate/core';
import { LoadingService } from './loading.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { File } from '@ionic-native/file/ngx';
import { AlertController, Platform } from '@ionic/angular';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { HTTP } from '@ionic-native/http/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { WebView } from '@ionic-native/ionic-webview/ngx';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  private database: SQLiteObject;
  private dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);

  reg_values = new BehaviorSubject([]);
  campaign = new BehaviorSubject([]);
  products = new BehaviorSubject([]);
  purchase_pic = new BehaviorSubject([]);
  product_list = new BehaviorSubject([]);
  product_quality = new BehaviorSubject([]);

  constructor(
    private file: File,
    private plt: Platform,
    private sqlitePorter: SQLitePorter,
    private HttpClient: HttpClient,
    public translate: TranslateService,
    public loading: LoadingService,
    private transfer: FileTransfer,
    private sqlite: SQLite,
    private webview: WebView,
    private alertCtrl: AlertController,
    public http: HTTP,
    private geolocation: Geolocation,
    private androidPermissions: AndroidPermissions,
    private backgroundMode: BackgroundMode
  ) {
    this.plt.ready().then(() => {
      this.sqlite.create({
        name: 'icollect_warehouse_0.0.1.db',
        location: 'default'
      })
        .then((db: SQLiteObject) => {
          this.database = db;
          this.createTables();
        });
    })
  }


  createTables() {
    this.translate.get('DB_CREATION').subscribe(value => {
      this.loading.showLoader(value);
    });

    this.HttpClient.get('../../assets/database.sql', { responseType: 'text' })
      .subscribe(sql => { 
        this.sqlitePorter.importSqlToDb(this.database, sql)
          .then(_ => {
            this.dbReady.next(true);
            this.filePermission();
            this.cameraPermission();
            this.geolocationPermission();

            this.createDocumentsDir();

            this.loadRegvaluesDB();

            this.loading.hideLoader();
          })
          .catch(e => { console.error(e); });
      });
  }

  filePermission() {
    this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE).then(
      result => console.log('Has permission?', result.hasPermission),
      err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
    );
  }

  cameraPermission() {
    this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.CAMERA).then(
      result => console.log('Has permission?', result.hasPermission),
      err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.CAMERA)
    );
  }

  geolocationPermission() {
    this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION).then(
      result => console.log('Has permission?', result.hasPermission),
      err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION)
    );
  }

  async presentAlert(message, title) {
    const alert = await this.alertCtrl.create({
      message: message,
      subHeader: title,
      buttons: ['OK']
    });
    alert.present();
  }

  async loadRegvaluesDB() {
    this.countRegvalues().then(data => {
      if (data.total == 0) {
        this.backgroundMode.enable();

        let path = this.file.externalDataDirectory + 'tables/';
        let url = encodeURI("https://icoop.live/ic/uploads/regvalues.sql");

        this.file.checkFile(path, "regvalues.sql").then(() => {

          this.file.readAsText(path, "regvalues.sql").then(sql => {
            this.sqlitePorter.importSqlToDb(this.database, sql)
              .then(_ => {
                this.dbReady.next(true);
              }).catch(e => { console.error(e); });
          });

        }).catch(() => {
          const fileTransfer: FileTransferObject = this.transfer.create();
          fileTransfer.download(url, path + "regvalues.sql").then(() => {

            this.file.readAsText(path, "regvalues.sql").then(sql => {
              this.sqlitePorter.importSqlToDb(this.database, sql)
                .then(_ => {
                  this.dbReady.next(true);
                }).catch(e => { console.error(e); });
            });

          });
        });
      }
    });
  }

  getDatabaseState() {
    return this.dbReady.asObservable();
  }

  createDocumentsDir() {
    this.file.checkDir(this.file.externalDataDirectory, 'warehouse_photos').then(response => {
      console.log(response);
    }).catch(err => {
      console.log(err);
      this.file.createDir(this.file.externalDataDirectory, 'warehouse_photos', true).then(response => {
        console.log('Directory create' + response);
      }).catch(err => { console.log('Directory no create' + JSON.stringify(err)); });
    });
  }


  getNewId() {
    return this.database.executeSql("SELECT (id_contact*10000)+(strftime('%s','now')) As new_id FROM users", []).then(data => {
      return {
        new_id: data.rows.item(0).new_id
      }
    });
  }

  // Documents
  
  getPurchasePictures(): Observable<any[]> {
    return this.purchase_pic.asObservable();
  }

  saveDocData(id_contact, wh_purchase_transaction_id, filename, description, doc_type, id_palette) {
    var m = new Date();
    let date = m.getUTCFullYear() + "/" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "/" + ("0" + m.getUTCDate()).slice(-2) + " " + ("0" + m.getUTCHours()).slice(-2) + ":" + ("0" + m.getUTCMinutes()).slice(-2) + ":" + ("0" + m.getUTCSeconds()).slice(-2);

    this.geolocation.getCurrentPosition().then((resp) => {
      let data = [id_contact, wh_purchase_transaction_id, date, doc_type, filename, resp.coords.latitude, resp.coords.longitude, resp.coords.accuracy, resp.coords.heading, resp.coords.altitudeAccuracy, description, 0, id_palette];

      return this.database.executeSql('INSERT INTO documents (agent_id, wh_purchase_transaction_id, doc_date, doc_type, filename, coordx, coordy, accuracy, heading, altitude, description, sync, id_palette) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', data).then(_ => {
        /*this.translate.get('DOCUMENT_SAVE_SUCCESS').subscribe(value => {
          this.presentAlert(value, 'Success');
        });*/
      });

    }).catch((error) => { 
      this.translate.get('LOCATION_ERROR').subscribe(value => {
        this.presentAlert(value + JSON.stringify(error), 'Error');
      });
    });
  }

  loadPurchasePicturesSync() {
    return this.database.executeSql('SELECT id_doc, doc_type, cloud_path, agent_id, wh_purchase_transaction_id, filename, description, doc_date, sync, coordx, coordy, accuracy, heading, id_palette FROM documents WHERE sync != 1 AND cloud_path IS NULL', []).then(data => {
      let purchase_docList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          let media_path;
          if (data.rows.item(i).cloud_path != null) {
            media_path = this.pathForImage(data.rows.item(i).cloud_path);
          } else {
            let filePath = this.file.externalDataDirectory + 'warehouse_photos/' + data.rows.item(i).filename;
              media_path = this.pathForImage(filePath);
          }

          purchase_docList.push({
            id_doc: data.rows.item(i).id_doc,
            filename: data.rows.item(i).filename,
            description: data.rows.item(i).description,
            doc_date: data.rows.item(i).doc_date,
            doc_type: data.rows.item(i).doc_type,
            sync: data.rows.item(i).sync,
            wh_purchase_transaction_id: data.rows.item(i).wh_purchase_transaction_id,
            coordx: data.rows.item(i).coordx,
            coordy: data.rows.item(i).coordy,
            accuracy: data.rows.item(i).accuracy,
            heading: data.rows.item(i).heading,
            agent_id: data.rows.item(i).agent_id,
            cloud_path: data.rows.item(i).cloud_path,
            id_palette: data.rows.item(i).id_palette,
            photo: media_path
          });
        }
      }

      this.purchase_pic.next(purchase_docList);
    });
  }

  updateCloudLinkPurchaseDoc(cloud_path, id_doc) {
    return this.database.executeSql('UPDATE documents SET cloud_path=?, sync=1 WHERE id_doc=?', [cloud_path, id_doc]).then(() => {
      this.loadPurchasePicturesSync();
    });
  }

  pathForImage(img) {
    if (img === null) {
      return '';
    } else {
      let converted = this.webview.convertFileSrc(img);
      return converted;
    }
  }

  updateSyncDoc(sync, id_doc) {
    return this.database.executeSql('UPDATE documents SET sync=? WHERE id_doc=?', [sync, id_doc]).then(() => {
      this.loadPurchasePicturesSync();
    });
  }

  deletePurchaseDoc(id_doc) {
    return this.database.executeSql('DELETE FROM documents WHERE id_doc=?', [id_doc]).then(() => {
      this.loadPurchasePicturesSync();
    });
  }

  loadPurchasePicturesTypes(doc_type) {

    return this.database.executeSql('SELECT id_doc, doc_type, cloud_path, agent_id, wh_purchase_transaction_id, filename, description, doc_date, sync, coordx, coordy, accuracy, heading, id_palette FROM documents WHERE doc_type = ?', [doc_type]).then(data => {
      let purchase_docList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          let media_path;
          if (data.rows.item(i).cloud_path != null) {
            media_path = this.pathForImage(data.rows.item(i).cloud_path);
          } else {
            let filePath = this.file.externalDataDirectory + 'warehouse_photos/' + data.rows.item(i).filename;
              media_path = this.pathForImage(filePath);
          }

          purchase_docList.push({
            id_doc: data.rows.item(i).id_doc,
            filename: data.rows.item(i).filename,
            description: data.rows.item(i).description,
            doc_date: data.rows.item(i).doc_date,
            doc_type: data.rows.item(i).doc_type,
            sync: data.rows.item(i).sync,
            wh_purchase_transaction_id: data.rows.item(i).wh_purchase_transaction_id,
            coordx: data.rows.item(i).coordx,
            coordy: data.rows.item(i).coordy,
            accuracy: data.rows.item(i).accuracy,
            heading: data.rows.item(i).heading,
            agent_id: data.rows.item(i).agent_id,
            cloud_path: data.rows.item(i).cloud_path,
            id_palette: data.rows.item(i).id_palette,
            photo: media_path
          });
        }
      }

      this.purchase_pic.next(purchase_docList);
    });
  }

  /*tickerAsNotSync() {
    return this.database.executeSql('UPDATE mobcrmticker SET sync = 0', []).then(() => {
      this.loadTickerData();
    });
  }*/

  // Regvalues

  getRegvalues(): Observable<any[]> {
    return this.reg_values.asObservable();
  }

  deleteRegvalues() {
    return this.database.executeSql('DELETE FROM registervalues', []);
  }

  loadRegvalues() {
    return this.database.executeSql('SELECT * FROM registervalues', []).then(data => {
      let reg_valuesList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          var cvalue;
          this.translate.get('CURRENT_LANGUAGE').subscribe(value => {
            if (value == 'en') {
              cvalue = data.rows.item(i).cvalue;
            } else {
              cvalue = data.rows.item(i).cvaluefr;
            }
          });

          reg_valuesList.push({
            id_regvalue: data.rows.item(i).id_regvalue,
            id_register: data.rows.item(i).id_register,
            regname: data.rows.item(i).regname,
            regcode: data.rows.item(i).regcode,
            nvalue: data.rows.item(i).nvalue,
            cvalue: cvalue,
            cvaluede: data.rows.item(i).cvaluede,
            cvaluefr: data.rows.item(i).cvaluefr,
            cvaluept: data.rows.item(i).cvaluept,
            cvaluees: data.rows.item(i).cvaluees,
            dvalue: data.rows.item(i).dvalue
          });
        }
      }

      this.reg_values.next(reg_valuesList);
    });
  }

  getRegvalue(id_regvalue: any) {
    return this.database.executeSql('SELECT id_regvalue, cvaluefr, cvalue FROM registervalues WHERE id_regvalue = ?', [id_regvalue]).then(data => {

      var cvalue;
      this.translate.get('CURRENT_LANGUAGE').subscribe(value => {
        if (value == 'en') {
          cvalue = data.rows.item(0).cvalue;
        } else {
          cvalue = data.rows.item(0).cvaluefr;
        }
      });

      return {
        id_regvalue: data.rows.item(0).id_regvalue,
        cvalue: cvalue
      }

    });
  }

  countRegvalues(): Promise<any> {
    return this.database.executeSql('SELECT COUNT(*) AS total FROM registervalues', []).then(data => {
      return {
        total: data.rows.item(0).total
      }
    });
  }


  getProducts(): Observable<any[]> {
    return this.product_list.asObservable();
  }

  loadProducts() {
    return this.database.executeSql('SELECT * FROM registervalues WHERE id_register=33 AND nvalue=6 ORDER BY id_regvalue ASC', []).then(data => {
      let productList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          var cvalue;
          this.translate.get('CURRENT_LANGUAGE').subscribe(value => {
            if (value == 'en') {
              cvalue = data.rows.item(i).cvalue;
            } else {
              cvalue = data.rows.item(i).cvaluefr;
            }
          });

          productList.push({
            id_regvalue: data.rows.item(i).id_regvalue,
            id_register: data.rows.item(i).id_register,
            regname: data.rows.item(i).regname,
            regcode: data.rows.item(i).regcode,
            nvalue: data.rows.item(i).nvalue,
            cvalue: cvalue,
            cvaluede: data.rows.item(i).cvaluede,
            cvaluefr: data.rows.item(i).cvaluefr,
            cvaluept: data.rows.item(i).cvaluept,
            cvaluees: data.rows.item(i).cvaluees,
            dvalue: data.rows.item(i).dvalue
          });
        }
      }

      this.product_list.next(productList);
    });
  }  


  getProductsQuality(): Observable<any[]> {
    return this.product_quality.asObservable();
  }

  loadProductsQuality() {
    return this.database.executeSql('SELECT * FROM registervalues WHERE id_register=301 ORDER BY id_regvalue DESC', []).then(data => {
      let productList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          var cvalue;
          this.translate.get('CURRENT_LANGUAGE').subscribe(value => {
            if (value == 'en') {
              cvalue = data.rows.item(i).cvalue;
            } else {
              cvalue = data.rows.item(i).cvaluefr;
            }
          });

          productList.push({
            id_regvalue: data.rows.item(i).id_regvalue,
            id_register: data.rows.item(i).id_register,
            regname: data.rows.item(i).regname,
            regcode: data.rows.item(i).regcode,
            nvalue: data.rows.item(i).nvalue,
            cvalue: cvalue,
            cvaluede: data.rows.item(i).cvaluede,
            cvaluefr: data.rows.item(i).cvaluefr,
            cvaluept: data.rows.item(i).cvaluept,
            cvaluees: data.rows.item(i).cvaluees,
            dvalue: data.rows.item(i).dvalue
          });
        }
      }

      this.product_quality.next(productList);
    });
  }

  // Campaign

  getCampaign(): Observable<any[]> {
    return this.campaign.asObservable();
  }

  getCampaignList() {
    return this.database.executeSql('SELECT id_regvalue, cvaluefr, cvalue FROM registervalues WHERE id_register = 299', []).then(data => {
      let reg_gendersList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          var cvalue;
          this.translate.get('CURRENT_LANGUAGE').subscribe(value => {
            if (value == 'en') {
              cvalue = data.rows.item(i).cvalue;
            } else {
              cvalue = data.rows.item(i).cvaluefr;
            }
          });

          reg_gendersList.push({
            id_regvalue: data.rows.item(i).id_regvalue,
            cvalue: cvalue
          });
        }
      }

      this.campaign.next(reg_gendersList);
    });
  }

  // Product

  getProduct(): Observable<any[]> {
    return this.products.asObservable();
  }

  getProductList() {
    return this.database.executeSql('SELECT id_regvalue, cvaluefr, cvalue FROM registervalues WHERE nvalue = 6', []).then(data => {
      let reg_gendersList: any[] = [];

      if (data.rows.length > 0) {
        for (var i = 0; i < data.rows.length; i++) {

          var cvalue;
          this.translate.get('CURRENT_LANGUAGE').subscribe(value => {
            if (value == 'en') {
              cvalue = data.rows.item(i).cvalue;
            } else {
              cvalue = data.rows.item(i).cvaluefr;
            }
          });

          reg_gendersList.push({
            id_regvalue: data.rows.item(i).id_regvalue,
            cvalue: cvalue
          });
        }
      }

      this.products.next(reg_gendersList);
    });
  }

  lastBackupData(): Promise<any> {
    return this.database.executeSql("SELECT id_data, data_type, data_date, data_download, data_upload FROM data WHERE data_type ='backup' AND data_upload=1 ORDER BY id_data DESC LIMIT 1", []).then(data => {
      if(data){
        return {
          id_data: data.rows.item(0).id_data,
          data_type: data.rows.item(0).data_type,
          data_date: data.rows.item(0).data_date,
          data_download: data.rows.item(0).data_download,
          data_upload: data.rows.item(0).data_upload
        }
      }
    });
  }

  // Data

  addData(data_type, data_date, data_download, data_upload, total_rows) {
    let data = [data_type, data_date, data_download, data_upload, total_rows];
    return this.database.executeSql('INSERT INTO data (data_type, data_date, data_download, data_upload, total_rows) VALUES (?, ?, ?, ?, ?)', data);
  }

  // User

  loadUser(username): Promise<any> {
    return this.database.executeSql('SELECT * FROM users WHERE username=?', [username]).then(data => {
      if (data.rows.length == 0) {
        return { length: 0 }
      } else {
        return {
          length: data.rows.length,
          id_contact: data.rows.item(0).id_contact,
          id_primary_company: data.rows.item(0).id_primary_company,
          id_user_supchain_type: data.rows.item(0).id_user_supchain_type,
          company_name: data.rows.item(0).company_name,
          username: data.rows.item(0).username,
          name: data.rows.item(0).name,
          agent_type: data.rows.item(0).agent_type,
          id_survey_tp: data.rows.item(0).id_survey_tp,
          lang: data.rows.item(0).lang,
          save_login: data.rows.item(0).save_login,
          pass_value: data.rows.item(0).pass_value,
          password_2: data.rows.item(0).password_2,
          password: data.rows.item(0).password,
          id_supchain_type: data.rows.item(0).id_supchain_type,
          id_supchain_company: data.rows.item(0).id_supchain_company,
          log: data.rows.item(0).log
        }
      }
    });
  }

  addUser(id_contact, id_primary_company, id_user_supchain_type, company_name, username, password, name, agent_type, password_2, lang, save_login, pass_value, id_cooperative, id_supchain_type, id_supchain_company) {
    let data = [id_contact, id_primary_company, id_user_supchain_type, company_name, username, password, name, agent_type, password_2, lang, save_login, pass_value, 1, id_cooperative, id_supchain_type, id_supchain_company];
    return this.database.executeSql('INSERT INTO users (id_contact, id_primary_company, id_user_supchain_type, company_name, username, password, name, agent_type, password_2, lang, save_login, pass_value, log, id_cooperative, id_supchain_type, id_supchain_company) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', data).then(val => {
      this.loadUser(username);
    });
  }

  checkLogin() {
    return this.database.executeSql('SELECT COUNT(*) AS total FROM users WHERE log=1', []).then(data => {
      return {
        total: data.rows.item(0).total
      }
    });
  }

  logIn(username, save_login) {
    return this.database.executeSql('UPDATE users SET log=?, save_login=? WHERE username=?', [1, save_login, username]).then(_ => {
      this.loadUser(username);
    });
  }

  deleteUser(username) {
    return this.database.executeSql('DELETE FROM users WHERE username = ?', [username]);
  }

  logAllOut() {
    return this.database.executeSql('UPDATE users SET log=0', []);
  }

  async restFetchUser(username, save_login_checked, lang): Promise<any> {
    return new Promise((resolve, reject) => {
      var v_security_new = 'https://idiscover.ch/postgrest/icollect/dev/v_security_mobile?username=eq.' + username;

      this.http.get(v_security_new, {}, {}).then(data => {
        let raw = JSON.parse(data.data);

        if (raw.length == 0) {
          this.translate.get('INCORRECT_USERNAME').subscribe(
            value => { this.presentAlert(value, 'Error'); }
          );

          reject();

        } else {

          var save_login = 0;
          let id_contact = raw[0].id_contact;
          let id_primary_company = raw[0].id_primary_company;
          let id_cooperative = raw[0].id_cooperative;
          let id_user_supchain_type = raw[0].id_user_supchain_type;
          let company_name = raw[0].company_name;
          let username = raw[0].username;
          let password = raw[0].password;
          let name = raw[0].name;
          let agent_type = raw[0].agent_type;
          let password_2 = raw[0].password_2;
          let id_supchain_type = raw[0].id_supchain_type;
          let id_supchain_company = raw[0].id_supchain_company;

          if (save_login_checked == true) { save_login = 1; }
          let pass_value = btoa(password);

          this.addUser(id_contact, id_primary_company, id_user_supchain_type, company_name, username, password, name, agent_type, password_2, lang, save_login, pass_value, id_cooperative, id_supchain_type, id_supchain_company);

          var m = new Date();
          let timestamp = m.getUTCFullYear() + "/" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "/" + ("0" + m.getUTCDate()).slice(-2) + " " + ("0" + m.getUTCHours()).slice(-2) + ":" + ("0" + m.getUTCMinutes()).slice(-2) + ":" + ("0" + m.getUTCSeconds()).slice(-2);
          this.addData('user', timestamp, 1, null, raw.lenth);

          resolve(true);
        }

      }).catch(error => {
        console.log(error.status);
        console.log(error.error); // error message as string
        console.log(error.headers);

        reject();
      });

    });
  }

  lastLogedUser(): Promise<any> {
    return this.database.executeSql('SELECT * FROM users WHERE log=?', [1]).then(data => {
      return {
        id_contact: data.rows.item(0).id_contact,
        id_primary_company: data.rows.item(0).id_primary_company,
        id_user_supchain_type: data.rows.item(0).id_user_supchain_type,
        company_name: data.rows.item(0).company_name,
        username: data.rows.item(0).username,
        name: data.rows.item(0).name,
        agent_type: data.rows.item(0).agent_type,
        id_survey_tp: data.rows.item(0).id_survey_tp,
        lang: data.rows.item(0).lang,
        save_login: data.rows.item(0).save_login,
        pass_value: data.rows.item(0).pass_value,
        password_2: data.rows.item(0).password_2,
        password: data.rows.item(0).password,
        id_cooperative: data.rows.item(0).id_cooperative,
        id_supchain_type: data.rows.item(0).id_supchain_type,
        id_supchain_company: data.rows.item(0).id_supchain_company,
        log: data.rows.item(0).log
      }
    });
  }
  
  // Logout

  logOut(id_contact) {
    return this.database.executeSql('UPDATE users SET log=? WHERE id_contact=?', [0, id_contact]);
  }

}
