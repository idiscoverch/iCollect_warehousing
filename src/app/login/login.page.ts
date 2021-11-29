import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../services/database.service';
import { LoadingService } from '../services/loading.service';
import { Md5 } from 'ts-md5/dist/md5';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  public lang: string;
  public username: string;
  public password: string;
  public save_login: any;
  public pass_value: any;

  public save_login_checked = false;

  constructor(
    public navCtrl: NavController,
    public translate: TranslateService,
    private router: ActivatedRoute,
    private db: DatabaseService,
    private loading: LoadingService,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.lang = this.router.snapshot.paramMap.get('lang');
    this.username = this.router.snapshot.paramMap.get('username');
    this.save_login = this.router.snapshot.paramMap.get('save_login');
    this.pass_value = this.router.snapshot.paramMap.get('pass_value');

    if (this.lang == "") {
      this.navCtrl.navigateRoot(['language']);
    }

    if (this.save_login == 1) {
      this.save_login_checked = true;

      if (this.pass_value != null) {
        this.password = this.router.snapshot.paramMap.get('pass_value');
      } else {
        this.password = this.router.snapshot.paramMap.get('password');
      }
    }

    this.translate.use(this.lang);
  }

  login() {
    this.translate.get('LOADING').subscribe(
      value => { this.loading.showLoader(value); }
    );

    if (this.username == null) {
      this.loading.hideLoader();
      this.translate.get('USERNAME_EMPTY').subscribe(
        value => { this.presentAlert(value, 'Error'); }
      );

    } else
      if (this.password == null) {
        this.loading.hideLoader();
        this.translate.get('PASSWORD_EMPTY').subscribe(
          value => { this.presentAlert(value, 'Error'); }
        );

      } else
        if ((this.username != null) && (this.password != null)) {

          var save_login;
          if (this.save_login_checked == true) {
            save_login = 1;
          } else { save_login = 0; }

          this.db.logAllOut();
          this.db.loadUser(this.username).then(usr => {
            if (usr.length == 0) {

              this.db.deleteUser(this.username).then(() => {
                this.db.restFetchUser(this.username, save_login, this.lang).then(
                  (val) => {
                    console.log(val);
                    this.checkLogin(save_login, true);

                  }, (err) => {
                    console.log(err);
                    this.loading.hideLoader();
                    this.translate.get('UNABLE_TO_CHECK_USER').subscribe(
                      value => { this.presentAlert(value, 'Error'); }
                    );
                  }
                );
              });

            } else {
              this.checkLogin(save_login, false);
            }
          });

        } else {
          this.loading.hideLoader();
          this.translate.get('USERNAME_OR_PASSWORD_EMPTY').subscribe(
            value => { this.presentAlert(value, 'Error'); }
          );
        }

  }

  checkLogin(save_login, fetch) {
    this.db.loadUser(this.username).then(usr => { 
      let success = false;

      if (usr.username == this.username) {
        if (save_login == 1) {
          if (this.pass_value != null) {
            if (this.password === usr.password) { success = true; }

          } else {
            if ((usr.password_2 != null) && (usr.password_2 != '')) {
              let password_hash = Md5.hashStr(this.password);
              if (password_hash === usr.password_2) { success = true; }

            } else {
              if (this.password === usr.password) { success = true; }
            }
          }

        } else {

          if ((usr.password_2 != null) && (usr.password_2 != '')) {
            let password_hash = Md5.hashStr(this.password);
            if (password_hash === usr.password_2) { success = true; }

          } else {
            if (this.password === usr.password) { success = true; }
          }
        }
      }

      this.loading.hideLoader();

      if (success == true) {
        this.db.logIn(this.username, save_login).then(() => {
          this.navCtrl.navigateRoot(['/tabs']);
        });

      } else {
        this.translate.get('INCORRECT_PASSWORD').subscribe(
          value => { this.presentAlert(value, 'Error'); }
        );
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

}
