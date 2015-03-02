$(document).ready(function () {

	if (window.File && window.FileReader) {
		$('#uploadButton').click(startUpload);
		$('#fileBox').change(fileChosen);
		$('#alertArea').html("<strong>Good news:</strong> Your browser supports the <strong>file API</strong>.");
		$('#alertArea').addClass("alert-info");

		var fr = new FileReader();
		if (!fr.readAsBinaryString) {
			$('#alertArea').text('The fileReader.readAsBinaryString method is unavailable! Please upgrade your browser or use another one.');
			$('#alertArea').addClass("alert-danger");
			$('#uploadArea').hide();
		}
		fr = null;
	} else {
		$('#uploadArea').hide();
		$('#alertArea').html("Your browser doesn't support the file API. Please update your browser.");
		$('#alertArea').addClass("alert-danger");
	}

	var selectedFile;
	function fileChosen(evt) {
		selectedFile = evt.target.files[0];
		$('#nameBox').val(selectedFile.name);
		if (!selectedFile.slice)
			console.log('KO: slice method unavailable...');
		else
			console.log('OK: slice method available.');
	}

	var socket = io.connect();

	var fileReader;
	var name;

	socket.on('moreData', function (data) {
		//La variable BLOCK_SIZE est définie dans app.js et passée en param au template ejs.
		updateBar(data['percent'], data['rate'], data['downloaded']);
		var start = data['place'] * BLOCK_SIZE; // the next block's starting position
		// the variable that will hold the new block of data
		var newFile;
		if (selectedFile.slice) {
			var end = start + Math.min(BLOCK_SIZE, (selectedFile.size - start));
			newFile = selectedFile.slice(start, end);
		} else
			alert('slice method doesn\'t exist !');
		fileReader.readAsBinaryString(newFile);

	});
	socket.on('done', function (data) {
		$('#uploadArea').show();
		$('#uploadInfo').hide();
		$('#alertArea').html($('<p/>').html("<strong>Nom du fichier:</strong> " + data.name));
		$('#alertArea').append($('<p/>').html("<strong>Taille du fichier (Mo):</strong> " + data.size));
		$('#alertArea').append($('<p/>').html("<strong>Téléchargé (Mo):</strong> " + data.downloaded));
		$('#alertArea').append($('<p/>').html("<strong>Date de début:</strong> " + data.startDate));
		$('#alertArea').append($('<p/>').html("<strong>Date de fin:</strong> " + data.finishDate));
		$('#alertArea').append($('<p/>').html("<strong>Temps écoulé (ms):</strong> " + data.elapsedTime));
		$('#alertArea').append($('<p/>').html("<strong>Taux de transfert (Mo/s):</strong> " + data.rate));

		// reset des inputs
		$('#fileBox').val('');
		$('#nameBox').val('');
	});
	socket.on('error', function (err) {
		$('#alertArea').text(err);
	});

	var uploading = false;
	function startUpload() {
		if ($('#fileBox').val() != '') {
			fileReader = new FileReader();
			uploading = true;
			name = $('#nameBox').val();
			$('#uploadArea').hide();
			$('#uploadInfo').show();
			$('#MB').text(toRoundedMegaByte(selectedFile.size) + "MB");
			
			fileReader.onload = function (evt) {
				socket.emit('upload', {
					'name' : name,
					'data' : evt.target.result
				});
			}
			socket.emit('start', {
				'name' : name,
				'size' : selectedFile.size
			});

			$('#resume-upload').hide();
		} else {
			alert('Please select a file.');
		}
	}
	function toRoundedMegaByte(val) {
		return Math.round(val / (1024 * 1024));
	}
	function updateBar(percent, rate, downloaded) {
		$('div.progress-bar').attr('style', 'width : ' + Math.round(percent) + '%');
		$('div.progress-bar').attr('aria-valuenow', Math.round(percent));
		$('div.progress-bar').text(Math.round(percent) + "%");
		$('#percent').html(Math.round(percent * 100) / 100 + '%');
		$('#uploaded').html(downloaded + "MB");
		$('#rate').html(rate + ' Mo/s');
	}
	
	$('#pause-upload').click(function () {
		socket.emit('pause', {
			'name' : name
		});
		$(this).hide();
		$('#resume-upload').show();
	});
	$('#resume-upload').click(function () {
		socket.emit('resume', {
			'name' : name
		});
		$(this).hide();
		$('#pause-upload').show();
	});
	$('#cancel-upload').click(function () {
		socket.emit('cancel', {
			'name' : name
		});

		$(this).hide();
		$('#resume-upload').hide();
		$('#pause-upload').hide();
		$('#uploadInfo').hide();
		$('#alertArea').text('The file upload has been cancelled.');
		$('#uploadArea').show();
		$('#fileBox').val('');
		$('#nameBox').val('');
	});

	$(":file").filestyle();
	$('#uploadInfo').hide();
});
