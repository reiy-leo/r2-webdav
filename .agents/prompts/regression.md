# 部署后回归

把 `$A` 设成 `rei:<密码>`，`$U` 设成 `https://r.rei8t.dev`，在一个临时文件夹里测，测完删掉。

```sh
curl -u $A -X PROPFIND -H 'Depth: 1' $U/            # 207 多状态
curl -u $A -X MKCOL $U/t/                            # 201 已创建
curl -u $A -T a.txt $U/t/a.txt                       # 201 已创建
curl -u $A $U/t/a.txt                                # 文件内容
curl -u $A -X MOVE -H "Destination: $U/t/b.txt" $U/t/a.txt   # 201
curl -u $A -X DELETE $U/t/                           # 204 无内容
curl $U/                                             # 401 未授权
curl -X OPTIONS -H 'Origin: chrome-extension://x' -H 'Access-Control-Request-Method: PROPFIND' -D - $U/   # 200，带 allow-methods / allow-headers
```

再用浏览器打开 `$U/`，看一眼列表、上传、重命名、删除，明暗两套都截图。
