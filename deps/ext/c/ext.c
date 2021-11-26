#include <stdlib.h>
#include "sqlite3ext.h"
#include "rust_ext.h"
SQLITE_EXTENSION_INIT1

static void wrap_date_parse(
  sqlite3_context *context,
  int argc,
  sqlite3_value **argv
){
  char *pattern = (char*) sqlite3_value_text(argv[0]);
  char *value = (char*) sqlite3_value_text(argv[1]);

  if (value == NULL) {
    sqlite3_result_null(context);
    return;
  }

  char *ret = date_parse(pattern, value);

  if (ret != NULL) {
    sqlite3_result_text(context, ret, -1, free);
  } else {
    sqlite3_result_null(context);
  }
}

static void wrap_regex_extract(
  sqlite3_context *context,
  int argc,
  sqlite3_value **argv
){
  char *pattern = (char*) sqlite3_value_text(argv[0]);
  char *value = (char*) sqlite3_value_text(argv[1]);

  if (value == NULL) {
    sqlite3_result_null(context);
    return;
  }

  char *ret = regex_extract(pattern, value);

  if (ret != NULL) {
    sqlite3_result_text(context, ret, -1, free);
  } else {
    sqlite3_result_null(context);
  }
}

static void wrap_regex_replace(
  sqlite3_context *context,
  int argc,
  sqlite3_value **argv
){
  char *pattern = (char*) sqlite3_value_text(argv[0]);
  char *value = (char*) sqlite3_value_text(argv[1]);
  char *rep = (char*) sqlite3_value_text(argv[2]);
  int once = sqlite3_value_int(argv[3]);

  if (value == NULL) {
    sqlite3_result_null(context);
    return;
  }

  char *ret = regex_replace(pattern, value, rep, once);

  if (ret != NULL) {
    sqlite3_result_text(context, ret, -1, free);
  } else {
    sqlite3_result_null(context);
  }
}

#ifdef _WIN32
__declspec(dllexport)
#endif
int sqlite3_ext_init(
  sqlite3 *db,
  char **pzErrMsg,
  const sqlite3_api_routines *pApi
){
  int rc = SQLITE_OK;
  SQLITE_EXTENSION_INIT2(pApi);
  (void)pzErrMsg;  /* Unused */

  rc = sqlite3_create_function(db, "regex_extract", 2, SQLITE_UTF8|SQLITE_INNOCUOUS, 0, wrap_regex_extract, 0, 0);
  if (rc != SQLITE_OK)  {
    return rc;
  }

  rc = sqlite3_create_function(db, "regex_replace", 4, SQLITE_UTF8|SQLITE_INNOCUOUS, 0, wrap_regex_replace, 0, 0);
  if (rc != SQLITE_OK)  {
    return rc;
  }

  rc = sqlite3_create_function(db, "date_parse", 2, SQLITE_UTF8|SQLITE_INNOCUOUS, 0, wrap_date_parse, 0, 0);
  if (rc != SQLITE_OK)  {
    return rc;
  }

  return rc;
}
