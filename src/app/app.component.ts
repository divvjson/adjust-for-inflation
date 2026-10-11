import { Component, ElementRef, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import * as _moment from 'moment';
import { default as _rollupMoment, Moment } from 'moment';
import moment from 'moment';
import sv from '@angular/common/locales/sv';
import { registerLocaleData } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

const SCB_CPI_BASE_URL = 'https://api.scb.se/OV0104/v1/doris/sv/ssd/START/PR/PR0101/PR0101A';
const CURRENT_CPI_START = moment('2026-01-01');
const HISTORICAL_CPI = { url: `${SCB_CPI_BASE_URL}/KPI2020M1980`, contentsCode: '000007T9' };
const CURRENT_CPI = { url: `${SCB_CPI_BASE_URL}/KPI2020M`, contentsCode: '00000808' };

type Calculation = {
  amount: number;
  from: Moment;
  through: Moment
  result: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public isHandset = window.matchMedia('(max-width: 599px)').matches;
  public minDate = moment('1980-01-01');
  public maxDate = moment().subtract(2, 'months');
  public amount: number | null = null;
  public from: Moment | null = null;
  public through: Moment | null = null;
  public isLoading = false;
  public calculation: Calculation | null = null;

  constructor(
    private http: HttpClient,
    private elementRef: ElementRef<HTMLElement>
  ) {
    moment.locale('sv');
    registerLocaleData(sv);
    this.loadAvailableDateRange();
  }

  private async loadAvailableDateRange() {
    const [historicalMetadata, currentMetadata] = await Promise.all([
      lastValueFrom(this.http.get(HISTORICAL_CPI.url)) as Promise<any>,
      lastValueFrom(this.http.get(CURRENT_CPI.url)) as Promise<any>
    ]);
    const historicalTid = historicalMetadata.variables.find((v: any) => v.code === 'Tid');
    const currentTid = currentMetadata.variables.find((v: any) => v.code === 'Tid');
    this.minDate = moment(historicalTid.values.at(0), 'YYYY[M]MM');
    this.maxDate = moment(currentTid.values.at(-1), 'YYYY[M]MM');
  }

  public openDatepicker(event: Event, datepickerRef: MatDatepicker<Moment>) {
    event.preventDefault();
    datepickerRef.open();
  }

  public setFromMonthAndYear(normalizedMonthAndYear: Moment, datepickerRef: MatDatepicker<Moment>) {
    this.from = moment(normalizedMonthAndYear);
    datepickerRef.close();
  }

  public setThroughMonthAndYear(normalizedMonthAndYear: Moment, datepickerRef: MatDatepicker<Moment>) {
    this.through = moment(normalizedMonthAndYear);
    datepickerRef.close();
  }

  public isFormValid() {
    if (this.amount === null) {
      return false;
    }

    if (this.amount === 0) {
      return false;
    }

    if (this.from === null) {
      return false;
    }

    if (this.through === null) {
      return false;
    }

    return true;
  }

  public async handleSubmit() {
    this.isLoading = true;
    this.calculation = null;

    const amount = this.amount!;
    const from = this.from!;
    const through = this.through!;

    if (from.isSame(through, 'month')) {
      this.calculation = {
        amount: amount,
        from: from,
        through: through,
        result: Math.round(amount)
      };
    } else {
      const [fromCpi, throughCpi] = await Promise.all([
        this.getCpi(from),
        this.getCpi(through)
      ]);

      this.calculation = {
        amount: amount,
        from: from,
        through: through,
        result: Math.round(this.getResult(amount, fromCpi, throughCpi))
      };
    }

    this.isLoading = false;

    setTimeout(() => {
      this.elementRef.nativeElement.scrollTo({
        top: this.elementRef.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    }, 1);
  }

  private async getCpi(month: Moment) {
    const source = month.isBefore(CURRENT_CPI_START, 'month') ? HISTORICAL_CPI : CURRENT_CPI;
    const url = source.url;
    const body = {
      query: [
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: [
              source.contentsCode
            ]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [
              month.format('YYYY[M]MM')
            ]
          }
        }
      ],
      response: {
        format: "json"
      }

    };
    const headers = { 'Content-Type': 'text/plain' }
    const request = this.http.post(url, JSON.stringify(body), { headers: headers });
    const response = await lastValueFrom(request) as any;

    return Number(response.data.at(0).values.at(0));
  }

  private getResult(amount: number, fromCpi: number, throughCpi: number) {
    return amount * (throughCpi / fromCpi);
  }

  @HostListener('window:resize', ['$event'])
  handleResize() {
    this.isHandset = window.matchMedia('(max-width: 599px)').matches;
  }
}
