extern crate chrono;
extern crate libc;
extern crate regex;

use std::ffi::CString;
use std::mem::{forget, transmute};
use std::ptr::null;

use chrono::{NaiveDate, SecondsFormat, Utc, TimeZone};
use libc::c_char;
use regex::Regex;

fn get_string(input: *mut c_char) -> String {
    let c_str = unsafe { CString::from_raw(input) };
    let s = c_str.to_str().unwrap().to_owned();
    forget(c_str);

    return s;
}

fn to_c_char_pointer(input: String) -> *const c_char {
    let c_str = CString::new(input).unwrap();

    let data: *const CString = unsafe { transmute(&c_str) };
    forget(c_str);
    return unsafe { (&*data).as_ptr() };
}

#[no_mangle]
pub extern "C" fn date_parse(
    pattern: *mut c_char,
    value: *mut c_char,
) -> *const c_char {
    let pattern = get_string(pattern);
    let value = get_string(value);

    return match Utc.datetime_from_str(&value, &pattern) {
        Ok(time) => to_c_char_pointer(time.to_rfc3339_opts(SecondsFormat::Millis, true)),
        Err(_) =>  match NaiveDate::parse_from_str(&value, &pattern) {
            Ok(time) => to_c_char_pointer(time.format("%Y-%m-%d").to_string()),
            Err(_) => null(),
        },
    };
}

#[no_mangle]
pub extern "C" fn regex_extract(
   pattern: *mut c_char,
   value: *mut c_char,
) -> *const c_char {
    let pattern = get_string(pattern);
    let value = get_string(value);

    let re = match Regex::new(&pattern) {
        Ok(re) => re,
        Err(_) => return null()
    };
    let caps = match re.captures(&value) {
        Some(caps) => caps,
        None => return null()
    };

    if caps.len() <= 1 {
        return null();
    }

    return to_c_char_pointer(caps.get(1).unwrap().as_str().to_owned());
}

#[no_mangle]
pub extern "C" fn regex_replace(
    pattern: *mut c_char,
    value: *mut c_char,
    rep: *mut c_char,
    once: i64,
) -> *const c_char {
    let pattern = get_string(pattern);
    let value = get_string(value);
    let rep = get_string(rep);

    let re = match Regex::new(&pattern) {
        Ok(re) => re,
        Err(_) => return null()
    };
    let replaced = if once != 0 {
        re.replace(&value, &rep)
    } else {
        re.replace_all(&value, &rep)
    };

    return to_c_char_pointer(replaced.as_ref().to_owned());
}
