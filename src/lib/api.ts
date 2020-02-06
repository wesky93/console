/* eslint-disable camelcase */
import axios, { AxiosInstance, AxiosError } from 'axios';
import VueCookies from 'vue-cookies';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
import { VNode } from 'vue';
import {
    computed, reactive, Ref, ref,
} from '@vue/composition-api';
import { VueInstance } from '@vue/composition-api/dist/types/vue';

class APIError extends Error {
    public status: number;

    public code:string;

    public axiosError:AxiosError;

    constructor(axiosError:AxiosError) {
        super();

        // @ts-ignore
        if (Error.captureStackTrace) {
            // @ts-ignore
            Error.captureStackTrace(this, APIError);
        }

        this.name = 'APIError';
        this.status = 500;
        this.code = 'ERROR_UNKNOWN';
        this.axiosError = axiosError;

        if (axiosError.response) {
            this.status = axiosError.response.status;

            if (axiosError.response.data.error) {
                this.message = axiosError.response.data.error.message;
                this.code = axiosError.response.data.error.code;
            } else {
                this.message = axiosError.response.statusText;
            }
        } else {
            this.message = axiosError.message;
        }
    }
}

class API {
    public instance:AxiosInstance|null;

    public constructor() { this.instance = null; }

    getExpireTimes=(accessToken:string):number => {
        const decodedToken = jwt.decode(accessToken);
        return decodedToken.exp - Math.floor(Date.now() / 1000);
    }

    createAxiosInstance=(baseURL:string):void => {
        const axiosConfig = {
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        this.instance = axios.create(axiosConfig);
        // @ts-ignore
        const accessToken = VueCookies.get('accessToken');
        if (accessToken) {
            this.instance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        }
    }

    setResponseInterceptor=(handlers:any):void => {
        (this.instance as AxiosInstance).interceptors.response.use((response) => {
            const accessToken = response.headers['access-token'];
            if (accessToken) {
                this.setAccessToken(accessToken);
            }
            return response;
        }, (e) => {
            const apiError = new APIError(e);

            if (apiError.status === 401) {
                if (handlers.authError) {
                    handlers.authError(apiError);
                }
            }

            return Promise.reject(apiError);
        });
    }

    setAccessToken=(accessToken:string):void => {
        (this.instance as AxiosInstance).defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        const expireTimes:number = this.getExpireTimes(accessToken);
        // @ts-ignore
        VueCookies.set('accessToken', accessToken, expireTimes);
    }

    removeAccessToken=():void => {
        if (this.instance) {
            delete this.instance.defaults.headers.common.Authorization;
        }
        // @ts-ignore
        VueCookies.remove('accessToken');
    }

    checkAccessToken=():boolean => {
        // @ts-ignore
        const accessToken = VueCookies.get('accessToken');
        if (accessToken) {
            return true;
        }
        return false;
    }

    init=(baseURL:string, handlers:any = {}):void => {
        if (!this.instance) {
            this.createAxiosInstance(baseURL);
            this.setResponseInterceptor(handlers);
        }
    }
}

export default new API();

export const operatorMap = Object.freeze({
    '': 'contain_in', // merge operator
    '!': 'not_contain', // merge operator
    '>': 'gt',
    '>=': 'gte',
    '<': 'lt',
    '<=': 'lte',
    '=': 'in', // merge operator
    '!=': 'not_in', // merge operator
    $: 'regex',
});

const mergeOperatorSet = new Set(['contain_in', 'not_contain_in', 'in', 'not_in']);

interface Sort {
    key:string;
    desc?:boolean;
}

interface Page {
    start:number;
    limit?:number;
}

interface Filter{
    k?:string;
    o?:string;
    v?:any;
    key?:string;
    operation?:string;
    value?:any;
}

interface ApiQuery {
    page?:Page;
    sort?:Sort;
    keyword?:string;
    filter?:Filter[];
    only?:string[];
}

interface SearchQuery {
    key:string,
    operator:string,
    value:string|number|Array<string|number>;
}
type ValueFormatter = (string, any)=>string|number|Array<string|number>;

/**
 * @name defaultQuery
 * @description make default query format
 * @param thisPage
 * @param pageSize
 * @param sortBy
 * @param sortDesc
 * @param searchText
 * @param searchQueries {Array<SearchQuery>}
 * @param valueFormatter <(key,value)=>value>
 * @returns {{page: {start: number, limit: *}}}
 */
export const defaultQuery = (
    thisPage:number, pageSize:number, sortBy?:string, sortDesc?:boolean,
    searchText?:string, searchQueries?:SearchQuery[], valueFormatter?:ValueFormatter,
) => {
    const query:ApiQuery = {
        page: {
            start: ((thisPage - 1) * pageSize) + 1,
            limit: pageSize,
        },
    };
    if (sortBy) {
        query.sort = {
            key: sortBy,
            desc: sortDesc,
        };
    }
    if (searchText) {
        query.keyword = searchText || '';
    }
    if (searchQueries) {
        const filter:Filter[] = [];
        // eslint-disable-next-line camelcase
        const mergeOpQuery:{[propName: string]: Filter;} = {};
        searchQueries.forEach((q) => {
            const op = operatorMap[q.operator];
            const value = valueFormatter ? valueFormatter(q.key, q.value) : q.value;
            if (mergeOperatorSet.has(op)) {
                const prefix = `${q.key}:${op}`;
                if (mergeOpQuery[prefix]) {
                    mergeOpQuery[prefix].v.push(value);
                } else {
                    mergeOpQuery[prefix] = {
                        k: q.key,
                        v: [value],
                        o: op,
                    };
                }
            } else {
                filter.push({
                    k: q.key,
                    v: value,
                    o: op,
                });
            }
        });
        // eslint-disable-next-line camelcase
        if (!_.isEmpty(filter) || !_.isEmpty(mergeOpQuery)) { query.filter = [...filter, ...Object.values(mergeOpQuery)]; }
    }
    return query;
};

/**
 * make value autocomplete query
 * @param key
 * @param value
 * @param itemLimit
 * @param sortBy
 * @param sortDesc
 * @return {{page: {start: number, limit: *}}}
 */
export const autoCompleteQuery = (searchQuery, itemLimit?:number, sortBy?:string, sortDesc?:boolean) => {
    const query:ApiQuery = {
        page: { start: 1, limit: itemLimit },
        only: [searchQuery.key],
    };
    if (sortBy) {
        query.sort = { key: sortBy, desc: sortDesc };
    }

    if (searchQuery.value) {
        query.filter = [{
            k: searchQuery.key,
            v: searchQuery.value,
            o: 'contain',
        }];
    }
    return query;
};


export interface HttpInstance {
    $http:AxiosInstance
}

export abstract class DynamicAPI {
    abstract getData();

    public abstract parent:HttpInstance;

    get $http() { return this.parent.$http; }
}

interface TableState {
    items:any[];
    pageSize: number;
    allPage: number;
    thisPage: number;
    searchText: string|null|undefined;
    loading: boolean;
}

export const getAllPage = (total_count:number, pageSize:number):number => Math.ceil(total_count / pageSize) || 1;

export class SubDataAPI extends DynamicAPI {
    public state :TableState;

    private query:Ref<object>;

    constructor(public parent:HttpInstance, private url, private idKey:string, private keyPath:Ref<string>, private id:Ref<string>) {
        super();
        this.state = reactive({
            items: [],
            pageSize: 15,
            allPage: 1,
            thisPage: 1,
            searchText: '',
            loading: false,
        });
        this.query = computed(() => (defaultQuery(
            this.state.thisPage, this.state.pageSize,
            undefined, undefined, this.state.searchText || '',
        )));
    }

    public getData = async () => {
        this.state.loading = true;
        this.state.items = [];

        const res = await this.$http.post(this.url, {
            query: this.query.value,
            key_path: this.keyPath.value,
            [this.idKey]: this.id.value,
        });
        this.state.items = res.data.results;
        this.state.allPage = getAllPage(res.data.total_count, this.state.pageSize);
        this.state.loading = false;
    }
}


export class MockSubDataAPI extends SubDataAPI {
    constructor(private items:any[]) {
        super(({ } as HttpInstance), '', '', ref(''), ref(''));
    }

    private fakeData=() => {
        this.state.items = this.items;
        this.state.allPage = 1;
        this.state.loading = false;
    }

    public getData= async () => {
        this.state.loading = true;
        this.state.allPage = 1;
        this.state.items = [];

        setTimeout(this.fakeData, 1000);
    }
}

interface MockData {
    total_count: number;
    results: Array<any>;
}

export const getMockData = (data: any, timeout: number) => new Promise((resolve, reject) => {
    setTimeout(() => resolve(data), timeout);
});

export const callApi = ($http: AxiosInstance, url: string, params: object) => $http.post(url, params);
