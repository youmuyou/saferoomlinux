var rows;
var config;
$(document).ready(function(){
	$("[rel=tooltip]").tooltip({ placement: 'right'});
	$('#summernote').summernote({height:300});
	// Getting current config
	CreateAJAX("/settings/config","GET","json",{})
	.done(function(response){

		// Setting configured values
		config = response;
		$("div[id*='Notebooks']").hide();
		$("select#txtService").val(config.system.default_service);
		switch(true)
		{
			case (config.system.default_service === 0): // Evernote
			    $("div#listNotebooks").show();
			    select_notebooks({});
			    $("div#listONSections").html("<select class='form-control' style='width:50%' id='txtSection'><option value=''>Not relevant for Evernote</option></select>");
				break;
			case (config.system.default_service === 1):
				$("div#listONNotebooks").show();
				select_onenote_notebooks({});
				break;

		}

		array = config.evernote.default_tags.split(",");
		if (array.length > 0){
			for (i=0;i<array.length;i++){
				$("input#txtTags").tagsinput('add',array[i]);
			}
		}

	})
	.fail(function(xhr){

	})

	$("button#btnAttach").click(function(){
		$("input#txtFiles").focus().trigger("click");
		//insertFile();
	});

	$("button#btnClear").click(function(){
		$("#summernote").summernote('reset');
	});

	$("button#btnEncrypt").click(function(){
		encrypt_note("master","");
	});	


});

$(document).on("change","input#txtFiles",function(){
	selectedFiles = $(this)[0].files;
	if (selectedFiles.length == 0){return;}
	var fd = new FormData();
	// Processing the list of files
	for (i=0;i<selectedFiles.length;i++){
		fd.append("attach[]",selectedFiles[i]);
	}
	
	// We need upload these files to temporary folder
	displayProgress(MSG_FILES_ATTACH,true);
	$.ajax({url : '/upload',type : 'POST',data : fd,
       processData: false,  // tell jQuery not to process the data
       contentType: false  // tell jQuery not to set contentType
	})
	.done(function(response){
		displayProgress("",false);
		for (i=0;i<selectedFiles.length;i++){
			insertFile(selectedFiles[i],response[i])
		}
	})
	.fail(function(xhr){
		displayProgress("",false);
		alert(MSG_INTERNAL_ERROR);
	})
});

$(document).on("click","span#removeAttach",function(){
	$(this).parent().parent().parent().parent().remove();
});
$(document).on("click","button#btnRefreshNotebooks",function(){

	// Displaying progress
	displayProgress(MSG_NOTEBOOKS_REFRESH,true);

	CreateAJAX("/notebooks/list/select","GET","html",{refresh:"True"})
	.done(function(response){
		displayProgress("",false);
		$("div#listNotebooks").html(response);
	})
	.fail(function(xhr){
		displayProgress("",false);
		$("div#listNotebooks").html(ERROR_NOTEBOOKS_LOAD);
	});

});


function insertFile(file,fileHash){
	var node = document.createElement('p');
	var tpl_attach
	node.setAttribute("id","saferoomAttach");
	switch(file.type)
	{
		case "image/jpeg":
		case "image/gif":
		case "image/png":
			node.innerHTML = TPL_IMAGE_ATTACH.replace("::fileType::",file.type).replace("::filename::",file.name).replace("::filehash::",fileHash).replace("::filename::",file.name).replace("::filename::",file.name);
			break;
		default:
			tpl_attach = replace_all(TPL_ATTACH,"::filename::",file.name);
			tpl_attach = replace_all(tpl_attach,"::filesize::",humanFileSize(file.size,true));
			tpl_attach = replace_all(tpl_attach,"::filehash::",fileHash);
			tpl_attach = replace_all(tpl_attach,"::fileicon::",getIcon(file.type));
			tpl_attach = replace_all(tpl_attach,"::filetype::",file.type);
			node.innerHTML = tpl_attach;			

			break;
	}
	
	$('#summernote').summernote('insertNode', node);
	//$('#summernote').summernote('insertNode',document.createElement("br"))

}



$(document).on("click","button#btnTags",function(){

	$("div#modalTags").modal('show');

	// Loading a list of tags
	CreateAJAX("/tags/list/","GET","html",{format:"select",refresh:"False"})
	.done(function(response){
		$("span#loader").hide();
		$("div#listTags").html(response);
		rows = $("table#tblTags tr");
	})
	.fail(function(xhr){
		$("span#loader").hide();
		$("div#listTags").html(xhr.responseText);
	})
});
$(document).on("keyup","input#txtSearch",function(){
	var val = $.trim($(this).val()).replace(/ +/g, ' ').toLowerCase();
	rows.show().filter(function() {
		var text = $(this).text().replace(/\s+/g, ' ').toLowerCase();
		return !~text.indexOf(val);
	}).hide();
});
$(document).on("click","button#btnRefresh",function(){
	// Loading a list of tags
	$("span#loader").show();
	CreateAJAX("/tags/list/","GET","html",{format:"select",refresh:"True"})
	.done(function(response){
		$("span#loader").hide();
		$("div#listTags").html(response);
		rows = $("table#tblTags tr");
	})
	.fail(function(xhr){
		$("span#loader").hide();
		$("div#listTags").html(xhr.responseText);
	})
})

$(document).on("click","input#chkAll",function(){
	$('input:checkbox').not(this).prop('checked', this.checked);
});

$(document).on("click","button#btnApply",function(){
	tagList = new Array();
	$("table#tblTags tr").each(function(){
		if ($(this).find("input").prop("checked") == true)
		{
			if ($(this).find("span").length != 0){
				tagList.push($(this).find("span").html());
			}
		}
	});

	for (i=0;i<tagList.length;i++){
		$("input#txtTags").tagsinput('add',tagList[i]);
	}
	$("div#modalTags").modal("hide");
	$("div#listTags").html("");
});
$(document).on("click","button#btnOTPEncrypt",function(){
	$("input#txtOTP").val("");
	$("div#modalOTP").modal("show");
});
$(document).on("click","button#btnOTPApply",function(){
	// Checking if the password has been specified
	if ($("input#txtOTP").val() == ""){
		$("input#txtOTP").focus();
		return;
	}

	// Closing modal window and start decryption procedure
	$("div#modalOTP").modal("hide");
	encrypt_note("otp",$("input#txtOTP").val());
});

function encrypt_note(mode,password)
{
	showAlert(false,"","");
		// Checking note title
		if ($("input#txtTitle").val() == ""){$("input#txtTitle").focus();return;}

		// Checking note content
		var noteContent = $("#summernote").summernote('code');
		if (noteContent == ""){
			alert("Note content cannot be empty");
			return;
		}	

		// Before sending the content to server, let's format it
		var tmpl = $("<div>"+noteContent+"</div>");
		var enml = "";
		var htmlAttach = "";
		var fileList = []
		var img;
		tmpl.find("p#saferoomAttach").each(function(){

			// We have image
			if ($(this).html().includes("img")){
				img = $(this).find("img");
				fileList.push({name:img.attr("data-filename"),mime:img.attr("data-type"),hash:img.attr("data-hash")});				
			}
			else{
				htmlAttach = $(this).next().html();
				enml = $(this).next().find("span#enml");
				if (enml != null){
					fileList.push({name:$(this).next().find("span#txtFilename").html(),mime:enml.find("en-media").attr("data-type"),hash:enml.find("en-media").attr("data-hash")});
					noteContent = noteContent.replace("<div class=\"attachment\">"+htmlAttach+"</div>",enml.html());
				}
			}
		});
		noteContent = noteContent.replace(/<p><br><\/p>/g, '<br/>');
		fileList = clear_array(fileList);		
		
		// Creating note request
		note = {}
		note['service'] = $("select#txtService").val();
		note['title'] = $("input#txtTitle").val();
		note['tags'] = $("input#txtTags").val();
		switch ($("select#txtService").val())
		{
			case "0":
				note['notebook_guid'] =$("select#txtNotebook option:selected").val()
				break;
			case "1":
			    note['notebook_guid'] =$("select#txtONNotebook option:selected").val()
			    break;
		}
		note['section_guid'] = $("select#txtSection option:selected").val();
		note['content'] = noteContent;
		note['filelist'] = JSON.stringify(fileList)
		note['mode'] = mode
		note['pass'] = password
		displayProgress(MSG_NOTE_UPLOAD,true);
		CreateAJAX("/note/create","POST","json",note).done(function(response){
			displayProgress("",false);
			if (response.status != HTTP_OK){
				showAlert(true,LEVEL_DANGER,response.message);
				scrollTop();
				return;
			}
			showAlert(true,LEVEL_SUCCESS,response.message);
			scrollTop();
		})
		.fail(function(xhr){
			displayProgress("",false);
			showAlert(true,LEVEL_DANGER,MSG_INTERNAL_ERROR);
		});s
}