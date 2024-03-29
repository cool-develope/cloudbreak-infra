//remove all spaces
export const regExpClearSpaces = new RegExp(" +");
//remove all next lines and \r tags
export const regExpClearNewLines = new RegExp(/[\r\n]+/gm);

export function getSearchArrByString(search: string):string[]{
    return search.replace(regExpClearNewLines, "").trim().split(regExpClearSpaces);
}

export function getSearchQueryByArr(arr:string[]):string{
    return arr.reduce((prev:string, curSearch:string, index:number) => {
        return index === 0 ? prev + `*${curSearch}*` : prev + ` *${curSearch}*`
    }, "")
}